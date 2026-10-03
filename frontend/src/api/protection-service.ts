import { listRows, saveRows } from '@/data/local-store'
import type {
  ActionResult,
  DeviceDetail,
  DeviceFilter,
  DeviceView,
  EntryRow,
  FilterMismatch,
  Shard,
} from '@/data/types'

// 保护业务领域服务：装置台账、保护校验、定值整定、更换申请之间的联动都在这里收口，
// 页面只做渲染；规则口径统一，避免列表和详情各算各的。

export const EMPTY_FILTER: DeviceFilter = {
  装置编号: '',
  所属间隔: '',
  装置型号: '',
  保护类型: '',
  校验日起: '',
  校验日止: '',
}

const DEVICE_KEY = 'protectiondevice'
const RELAY_KEY = 'relaytest'
const SETTING_KEY = 'settingvalue'
const REPLACEMENT_KEY = 'replacementrequest'

function devices(): EntryRow[] {
  return listRows(DEVICE_KEY)
}

function relays(): EntryRow[] {
  return listRows(RELAY_KEY)
}

function settings(): EntryRow[] {
  return listRows(SETTING_KEY)
}

function replacements(): EntryRow[] {
  return listRows(REPLACEMENT_KEY)
}

function nextId(rows: EntryRow[]): number {
  return rows.reduce((max, row) => Math.max(max, Number(row.id)), 0) + 1
}

export function findDevice(code: string): EntryRow | undefined {
  return devices().find((row) => String(row.装置编号) === code)
}

/**
 * 上次校验日的唯一口径：
 * 以最近一次「校验合格」或「校验中/待校验」的校验记录为准，记录日期新于台账就覆盖台账值。
 * 列表和详情面板都走这一个函数，保证两处是同一份。
 */
function decorate(row: EntryRow): DeviceView {
  const ledgerDate = String(row.上次校验日 ?? '')
  const records = relays()
    .filter((record) => String(record.装置名称) === String(row.装置编号))
    .filter((record) => String(record.校验日期))
    .sort((a, b) => String(a.校验日期).localeCompare(String(b.校验日期)))
  const latest = records[records.length - 1]
  if (latest && String(latest.校验日期) > ledgerDate) {
    return {
      ...row,
      上次校验日: String(latest.校验日期),
      上次校验日来源: `以最近一次校验记录 ${String(latest.校验编号)} 为准`,
    }
  }
  return { ...row, 上次校验日: ledgerDate, 上次校验日来源: '台账登记' }
}

export function allDeviceViews(): DeviceView[] {
  return devices().map(decorate)
}

const TEXT_FIELDS: Array<keyof DeviceFilter> = ['装置编号', '所属间隔', '装置型号', '保护类型']

function activeConditions(filter: DeviceFilter) {
  return {
    texts: TEXT_FIELDS.map((field) => ({ field, value: filter[field].trim() })).filter((item) => item.value),
    from: filter.校验日起.trim(),
    to: filter.校验日止.trim(),
  }
}

function matchText(row: DeviceView, field: string, value: string): boolean {
  return String(row[field] ?? '').includes(value)
}

function matchDateRange(row: DeviceView, from: string, to: string): boolean {
  const date = String(row.上次校验日 ?? '')
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

function matchAll(row: DeviceView, filter: DeviceFilter): boolean {
  const cond = activeConditions(filter)
  for (const item of cond.texts) {
    if (!matchText(row, item.field, item.value)) return false
  }
  return matchDateRange(row, cond.from, cond.to)
}

/** 逐条件单独跑一遍：某条件单独命中为 0，就是它把结果清零的。 */
function diagnose(filter: DeviceFilter, pool: DeviceView[]): FilterMismatch[] {
  const cond = activeConditions(filter)
  const result: FilterMismatch[] = []
  for (const item of cond.texts) {
    result.push({
      label: item.field,
      expected: item.value,
      aloneHits: pool.filter((row) => matchText(row, item.field, item.value)).length,
    })
  }
  if (cond.from || cond.to) {
    result.push({
      label: '上次校验日',
      expected: `${cond.from || '不限'} 至 ${cond.to || '不限'}`,
      aloneHits: pool.filter((row) => matchDateRange(row, cond.from, cond.to)).length,
    })
  }
  return result
}

/** 装置定位：编号/间隔/型号/保护类型叠加取交集，上次校验日按起止区间过滤，并按所属间隔分片。 */
export function queryDevices(filter: DeviceFilter): {
  items: DeviceView[]
  total: number
  shards: Shard[]
  mismatch: FilterMismatch[]
} {
  const pool = allDeviceViews()
  const items = pool.filter((row) => matchAll(row, filter))
  const shardMap = new Map<string, DeviceView[]>()
  for (const row of items) {
    const bay = String(row.所属间隔)
    const list = shardMap.get(bay) ?? []
    list.push(row)
    shardMap.set(bay, list)
  }
  const shards: Shard[] = [...shardMap.entries()]
    .map(([bay, shardItems]) => ({ bay, items: shardItems }))
    .sort((a, b) => a.bay.localeCompare(b.bay, 'zh'))
  return { items, total: items.length, shards, mismatch: items.length ? [] : diagnose(filter, pool) }
}

/** 保护类型选项：沿用台账里既有的保护类型口径，不另造一套词表。 */
export function protectionTypeOptions(): string[] {
  return [...new Set(devices().map((row) => String(row.保护类型)))].sort((a, b) => a.localeCompare(b, 'zh'))
}

export function modelOptions(): string[] {
  return [...new Set(devices().map((row) => String(row.装置型号)))].sort((a, b) => a.localeCompare(b, 'zh'))
}

/** 待校验清单：进入「需更换」之后的装置不再进清单（状态互斥，此处显式按规则过滤）。 */
export function listPendingDevices(): DeviceView[] {
  return allDeviceViews().filter((row) => row.status === '待校验')
}

/** 保护校验清单；需更换装置名下的待校验记录挂起，不进待校验清单。 */
export function listRelayRows(options: { pendingOnly?: boolean } = {}): {
  items: EntryRow[]
  excluded: EntryRow[]
} {
  const replaced = new Set(
    devices()
      .filter((row) => row.status === '需更换')
      .map((row) => String(row.装置编号)),
  )
  const items = relays().filter((row) => !(options.pendingOnly && row.status !== '待校验'))
  const visible = items.filter(
    (row) => !(row.status === '待校验' && replaced.has(String(row.装置名称))),
  )
  const excluded = items.filter(
    (row) => row.status === '待校验' && replaced.has(String(row.装置名称)),
  )
  return { items: visible, excluded }
}

export function deviceStats() {
  const all = allDeviceViews()
  return {
    total: all.length,
    pending: all.filter((row) => row.status === '待校验').length,
    normal: all.filter((row) => row.status === '运行正常').length,
    checked: all.filter((row) => row.status === '已校验').length,
    replace: all.filter((row) => row.status === '需更换').length,
    shards: new Set(all.map((row) => String(row.所属间隔))).size,
  }
}

export function deviceDetail(id: number): DeviceDetail | undefined {
  const device = devices().find((row) => Number(row.id) === id)
  if (!device) return undefined
  const code = String(device.装置编号)
  return {
    device: decorate(device),
    relays: relays()
      .filter((row) => String(row.装置名称) === code)
      .sort((a, b) => String(b.校验日期).localeCompare(String(a.校验日期))),
    replacements: replacements().filter((row) => String(row.装置编号) === code),
  }
}

export function listReplacements(): EntryRow[] {
  return replacements().sort((a, b) => String(b.申请日期).localeCompare(String(a.申请日期)))
}

export function registerDevice(input: {
  装置编号: string
  所属间隔: string
  装置型号: string
  保护类型: string
  投运日期: string
  校验周期: string
  装置专责: string
}): ActionResult {
  const code = input.装置编号.trim()
  const bay = input.所属间隔.trim()
  if (!code) return { ok: false, message: '装置编号不能为空' }
  if (!bay) return { ok: false, message: '所属间隔不能为空，装置按所属间隔分片维护' }
  if (!input.装置型号.trim() || !input.保护类型.trim()) {
    return { ok: false, message: '装置型号与保护类型都要填写' }
  }
  const rows = devices()
  if (rows.some((row) => String(row.装置编号) === code)) {
    return { ok: false, message: `装置编号 ${code} 已存在，不能重复登记` }
  }
  const status = '待校验'
  rows.push({
    id: nextId(rows),
    status,
    pending: true,
    abnormal: false,
    装置编号: code,
    所属间隔: bay,
    装置型号: input.装置型号.trim(),
    保护类型: input.保护类型.trim(),
    投运日期: input.投运日期 || '—',
    校验周期: input.校验周期.trim() || '6年',
    装置专责: input.装置专责.trim() || '未定',
    上次校验日: '—',
    装置状态: status,
  })
  saveRows(DEVICE_KEY, rows)
  return { ok: true, message: `保护装置 ${code} 已登记到「${bay}」，当前状态「待校验」` }
}

/** 校验周期由装置专责核定，不允许页面直接改。 */
export function approveCycle(id: number, cycle: string, approver: string): ActionResult {
  const rows = devices()
  const index = rows.findIndex((row) => Number(row.id) === id)
  if (index < 0) return { ok: false, message: '没有找到这台保护装置' }
  if (!cycle.trim()) return { ok: false, message: '校验周期不能为空' }
  rows[index] = {
    ...rows[index],
    校验周期: cycle.trim(),
    装置专责: approver.trim() || String(rows[index].装置专责 ?? ''),
  }
  saveRows(DEVICE_KEY, rows)
  return { ok: true, message: `校验周期已由装置专责核定为「${cycle.trim()}」` }
}

/** 完成校验：装置转「已校验」，并按最近一次校验记录刷新上次校验日。 */
export function completeCheck(id: number, date: string): ActionResult {
  const rows = devices()
  const index = rows.findIndex((row) => Number(row.id) === id)
  if (index < 0) return { ok: false, message: '没有找到这台保护装置' }
  if (rows[index].status === '需更换') {
    return { ok: false, message: '该装置已进入需更换，不再安排校验' }
  }
  if (!date) return { ok: false, message: '请填写本次校验日期' }
  rows[index] = {
    ...rows[index],
    status: '已校验',
    pending: false,
    上次校验日: date,
    装置状态: '已校验',
  }
  saveRows(DEVICE_KEY, rows)
  return { ok: true, message: `校验完成，${String(rows[index].装置编号)} 已转「已校验」，上次校验日记为 ${date}` }
}

export function setRunning(id: number): ActionResult {
  const rows = devices()
  const index = rows.findIndex((row) => Number(row.id) === id)
  if (index < 0) return { ok: false, message: '没有找到这台保护装置' }
  if (rows[index].status === '需更换') {
    return { ok: false, message: '已提出更换的装置不能登记运行' }
  }
  rows[index] = { ...rows[index], status: '运行正常', pending: false, 装置状态: '运行正常' }
  saveRows(DEVICE_KEY, rows)
  return { ok: true, message: `${String(rows[index].装置编号)} 已登记运行` }
}

/** 提出更换：同一台装置重复提交只落一条更换申请。 */
export function requestReplacement(id: number, reason: string): ActionResult {
  const rows = devices()
  const device = rows.find((row) => Number(row.id) === id)
  if (!device) return { ok: false, message: '没有找到这台保护装置' }
  const code = String(device.装置编号)
  const requestRows = replacements()
  const existing = requestRows.find((row) => String(row.装置编号) === code)
  if (existing) {
    return { ok: false, message: `${code} 的更换申请已存在（${String(existing.申请单号)}），不重复落单` }
  }
  const today = new Date().toISOString().slice(0, 10)
  const requestId = nextId(requestRows)
  requestRows.push({
    id: requestId,
    status: '待处理',
    pending: true,
    abnormal: false,
    申请单号: `REPL-${String(requestId).padStart(4, '0')}`,
    装置编号: code,
    所属间隔: String(device.所属间隔 ?? ''),
    装置型号: String(device.装置型号 ?? ''),
    申请原因: reason.trim() || '装置老化，建议更换',
    申请人: String(device.装置专责 ?? ''),
    申请日期: today,
    处理状态: '待处理',
  })
  saveRows(REPLACEMENT_KEY, requestRows)
  const index = rows.findIndex((row) => Number(row.id) === id)
  rows[index] = { ...rows[index], status: '需更换', pending: false, 装置状态: '需更换' }
  saveRows(DEVICE_KEY, rows)
  return { ok: true, message: `已提交更换申请：${code} 转「需更换」，并从待校验清单移除` }
}

/** 校验判定合格：结论同步到定值整定的待整定清单；同一校验结论只同步一次。 */
function syncQualifiedSetting(relay: EntryRow): boolean {
  const rows = settings()
  const sourceId = String(relay.校验编号)
  if (rows.some((row) => String(row.来源校验编号 ?? '') === sourceId)) {
    return false
  }
  const device = findDevice(String(relay.装置名称))
  const ptype = device ? String(device.保护类型) : String(relay.保护类型 ?? '保护')
  const id = nextId(rows)
  rows.push({
    id,
    status: '待整定',
    pending: true,
    abnormal: false,
    定值单号: `SETT-${String(id).padStart(4, '0')}`,
    所属装置: String(relay.装置名称),
    定值项目: `${ptype}定值复核`,
    整定值: '依据校验合格结论复核整定',
    计算依据: `校验合格同步（${sourceId}）`,
    整定人: '',
    审核人: '',
    定值状态: '待整定',
    来源校验编号: sourceId,
  })
  saveRows(SETTING_KEY, rows)
  return true
}

/** 保护校验动作：合格结论同步定值整定；需更换装置不再接收校验提交。 */
export function runRelayAction(id: number, action: string): ActionResult {
  const rows = relays()
  const index = rows.findIndex((row) => Number(row.id) === id)
  if (index < 0) return { ok: false, message: '没有找到这条校验记录' }
  const relay = rows[index]
  const targetByAction: Record<string, string> = {
    提交校验: '校验中',
    判定合格: '校验合格',
    标记不合格: '校验不合格',
  }
  const target = targetByAction[action]
  if (!target) return { ok: false, message: `没有登记「${action}」这个动作` }

  if (action === '提交校验') {
    const device = findDevice(String(relay.装置名称))
    if (device && device.status === '需更换') {
      return { ok: false, message: `${String(relay.装置名称)} 已进入需更换，不再进待校验清单` }
    }
  }

  rows[index] = {
    ...relay,
    status: target,
    pending: target === '校验中',
    abnormal: target === '校验不合格',
    校验状态: target,
  }
  saveRows(RELAY_KEY, rows)

  if (action === '判定合格') {
    // 同步回写装置：上次校验日以最近一次校验记录为准。
    const deviceRows = devices()
    const di = deviceRows.findIndex((row) => String(row.装置编号) === String(relay.装置名称))
    if (di >= 0 && String(relay.校验日期) > String(deviceRows[di].上次校验日 ?? '')) {
      deviceRows[di] = {
        ...deviceRows[di],
        status: '已校验',
        pending: false,
        上次校验日: String(relay.校验日期),
        装置状态: '已校验',
      }
      saveRows(DEVICE_KEY, deviceRows)
    }
    const synced = syncQualifiedSetting(rows[index])
    return {
      ok: true,
      message: synced
        ? `校验判定合格，结论已同步到定值整定待整定清单（${String(relay.装置名称)}）`
        : `校验判定合格；该结论此前已同步过待整定清单，不重复落单`,
    }
  }
  return { ok: true, message: `校验记录 ${String(relay.校验编号)} 已转「${target}」` }
}
