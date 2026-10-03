import { BAY_GROUPS } from '@/data/domain'
import { MODULE_BY_KEY } from '@/data/modules'
import { allRows, listRows, resetRows, saveRows } from '@/data/local-store'
import { nextCheckDate, parseCycleYears, todayISO } from '@/utils/date'
import type {
  ActionResult,
  DeviceDetail,
  DeviceFilters,
  DevicePageResult,
  EntryRow,
  FilterCell,
  ModuleMeta,
  OverviewResult,
  PageResult,
  PendingDevice,
} from '@/data/types'

// 会写进数据的「往回走」动作：命中就把这条记录标成异常态，看板上能一眼看出来。
const NEGATIVE_ACTIONS = ['撤销', '作废', '拒绝', '驳回', '停用', '忽略', '下线', '回滚']

const PROTECTION_KEY = 'protectiondevice'
const RELAYTEST_KEY = 'relaytest'
const SETTING_KEY = 'settingvalue'
const REPLACEMENT_KEY = 'replacementrequest'

const DEVICE_STATUS_FIELD = '装置状态'

export const EMPTY_DEVICE_FILTERS: DeviceFilters = {
  bay: '',
  deviceNo: '',
  model: '',
  protectionType: '',
  checkFrom: '',
  checkTo: '',
}

export function moduleMeta(key: string): ModuleMeta {
  const meta = MODULE_BY_KEY.get(key)
  if (!meta) {
    throw new Error(`没有登记名为 ${key} 的业务模块`)
  }
  return meta
}

export function filterRows(rows: EntryRow[], filters: Record<string, string>): EntryRow[] {
  const pairs = Object.entries(filters).filter(([, value]) => value.trim() !== '')
  if (pairs.length === 0) {
    return rows
  }
  return rows.filter((row) =>
    pairs.every(([field, value]) => String(row[field] ?? '').includes(value.trim())),
  )
}

export function listEntries(key: string, filters: Record<string, string> = {}): PageResult {
  const rows = key === PROTECTION_KEY ? listProtectionRows() : listRows(key)
  const matched = filterRows(rows, filters)
  return { items: matched, total: matched.length, page: 1, size: matched.length }
}

function padId(value: number, prefix: string): string {
  return `${prefix}-${String(value).padStart(4, '0')}`
}

function nextId(rows: EntryRow[]): number {
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1
}

function setDeviceRow(row: EntryRow, status: string): EntryRow {
  return {
    ...row,
    status,
    [DEVICE_STATUS_FIELD]: status,
    // 进入「需更换」之后不再进待校验清单，pending 随之置为 false
    pending: status !== '需更换',
    abnormal: status === '需更换',
  }
}

// ---------------------------------------------------------------------------
// 上次校验日一致性：装置列表与详情面板读到的都是同一份台账数据。
// 台账里的「上次校验日」与保护校验记录冲突时，以最近一次校验记录为准。
// 任何装置相关读操作之前都先过一遍对账，发现回写才落盘。
// ---------------------------------------------------------------------------
function reconcileCheckDate(): EntryRow[] {
  const devices = listRows(PROTECTION_KEY)
  const tests = listRows(RELAYTEST_KEY)
  const latestByDevice = new Map<string, EntryRow>()
  for (const test of tests) {
    const deviceNo = String(test['装置名称'] ?? '')
    if (!deviceNo) {
      continue
    }
    const current = latestByDevice.get(deviceNo)
    if (!current || String(test['校验日期'] ?? '') > String(current['校验日期'] ?? '')) {
      latestByDevice.set(deviceNo, test)
    }
  }

  let changed = false
  const next = devices.map((row) => {
    const latest = latestByDevice.get(String(row['装置编号'] ?? ''))
    if (!latest) {
      return row
    }
    const latestDate = String(latest['校验日期'] ?? '')
    if (!latestDate || String(row['上次校验日'] ?? '') === latestDate) {
      return row
    }
    changed = true
    return { ...row, 上次校验日: latestDate }
  })
  if (changed) {
    saveRows(PROTECTION_KEY, next)
  }
  return changed ? listRows(PROTECTION_KEY) : devices
}

function listProtectionRows(): EntryRow[] {
  return reconcileCheckDate()
}

function computeNextCheck(row: EntryRow): string {
  return nextCheckDate(
    String(row['上次校验日'] ?? ''),
    String(row['校验周期'] ?? ''),
    String(row['投运日期'] ?? ''),
  )
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime()
  const b = new Date(`${to}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86400000)
}

function isOverdue(row: EntryRow, reference = todayISO()): boolean {
  if (String(row.status) === '需更换') {
    return false
  }
  const next = computeNextCheck(row)
  return next !== '' && next < reference
}

// ---------------------------------------------------------------------------
// 定位：装置编号、装置型号、保护类型叠加取交集；上次校验日按起止闭区间过滤。
// ---------------------------------------------------------------------------
type SingleMatcher = {
  key: keyof DeviceFilters
  label: string
  value: string
  active: boolean
  match: (row: EntryRow) => boolean
}

function buildMatchers(filters: DeviceFilters): SingleMatcher[] {
  const deviceNo = filters.deviceNo.trim()
  const model = filters.model.trim()
  const protectionType = filters.protectionType.trim()
  const from = filters.checkFrom.trim()
  const to = filters.checkTo.trim()
  return [
    {
      key: 'bay',
      label: '所属间隔',
      value: filters.bay,
      active: filters.bay !== '',
      match: (row) => String(row['所属间隔'] ?? '') === filters.bay,
    },
    {
      key: 'deviceNo',
      label: '装置编号',
      value: deviceNo,
      active: deviceNo !== '',
      match: (row) => String(row['装置编号'] ?? '').toUpperCase().includes(deviceNo.toUpperCase()),
    },
    {
      key: 'model',
      label: '装置型号',
      value: model,
      active: model !== '',
      // 型号下拉是精确口径，手输片段也兼容包含匹配
      match: (row) => String(row['装置型号'] ?? '').toUpperCase().includes(model.toUpperCase()),
    },
    {
      key: 'protectionType',
      label: '保护类型',
      value: protectionType,
      active: protectionType !== '',
      match: (row) => String(row['保护类型'] ?? '') === protectionType,
    },
    {
      key: 'checkFrom',
      label: '上次校验日（起）',
      value: from,
      active: from !== '',
      match: (row) => {
        const date = String(row['上次校验日'] ?? '')
        return date !== '' && date >= from
      },
    },
    {
      key: 'checkTo',
      label: '上次校验日（止）',
      value: to,
      active: to !== '',
      match: (row) => {
        const date = String(row['上次校验日'] ?? '')
        return date !== '' && date <= to
      },
    },
  ]
}

export function listProtectionDevices(
  filters: DeviceFilters,
  page = 1,
  size = 20,
): DevicePageResult {
  const rows = listProtectionRows()
  const matchers = buildMatchers(filters)

  // 各格命中数统一按全量台账统计；交集条件叠加后再取最终结果
  const activeMatchers = matchers.filter((matcher) => matcher.active)
  const matched = rows.filter((row) => activeMatchers.every((matcher) => matcher.match(row)))

  const cells: FilterCell[] = matchers.map((matcher) => ({
    key: matcher.key,
    label: matcher.label,
    value: matcher.value,
    active: matcher.active,
    hits: rows.filter(matcher.match).length,
    matched: rows.filter(matcher.match).length > 0,
  }))
  if (activeMatchers.length > 0) {
    cells.push({
      key: 'combined',
      label: '全部条件取交集',
      value: activeMatchers.map((matcher) => matcher.label).join(' + '),
      active: true,
      hits: matched.length,
      matched: matched.length > 0,
    })
  }

  const bayGroups = BAY_GROUPS.map((group) => ({
    group: group.group,
    bays: group.bays.map((bay) => ({
      bay,
      count: rows.filter((row) => String(row['所属间隔']) === bay).length,
      overdue: rows.filter((row) => String(row['所属间隔']) === bay && isOverdue(row)).length,
    })),
  }))
  const groupCounts = bayGroups.map((group) => ({
    group: group.group,
    count: group.bays.reduce((sum, item) => sum + item.count, 0),
    overdue: group.bays.reduce((sum, item) => sum + item.overdue, 0),
  }))

  const sorted = [...matched].sort((a, b) =>
    String(a['装置编号']).localeCompare(String(b['装置编号'])),
  )
  const total = sorted.length
  const safeSize = Math.max(1, size)
  const safePage = Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / safeSize)))
  const start = (safePage - 1) * safeSize
  return {
    items: sorted.slice(start, start + safeSize),
    total,
    page: safePage,
    size: safeSize,
    cells,
    bayGroups,
    groupCounts,
  }
}

// 待校验清单：下次校验日已到期即进，进入需更换之后不再进。
export function listPendingDevices(): PendingDevice[] {
  const reference = todayISO()
  return listProtectionRows()
    .filter((row) => isOverdue(row, reference))
    .map((row) => {
      const next = computeNextCheck(row)
      return { row, nextCheck: next, daysOverdue: daysBetween(next, reference) }
    })
    .sort((a, b) => a.nextCheck.localeCompare(b.nextCheck))
}

export function getDeviceDetail(id: number): DeviceDetail | null {
  const devices = listProtectionRows()
  const device = devices.find((row) => Number(row.id) === id)
  if (!device) {
    return null
  }
  const deviceNo = String(device['装置编号'])
  const relayTests = listRows(RELAYTEST_KEY)
    .filter((row) => String(row['装置名称']) === deviceNo)
    .sort((a, b) => String(b['校验日期']).localeCompare(String(a['校验日期'])))
  const replacements = listRows(REPLACEMENT_KEY)
    .filter((row) => String(row['装置编号']) === deviceNo)
    .sort((a, b) => String(b['申请日期']).localeCompare(String(a['申请日期'])))
  const settings = listRows(SETTING_KEY)
    .filter((row) => String(row['所属装置']) === deviceNo)
    .sort((a, b) => String(a['定值单号']).localeCompare(String(b['定值单号'])))
  const next = computeNextCheck(device)
  return {
    device,
    nextCheck: next,
    daysOverdue: next ? daysBetween(next, todayISO()) : 0,
    relayTests,
    replacements,
    settings,
  }
}

// 装置统计卡：状态口径以对账后的全量台账为准
export function protectionStatusCounts(): Record<string, number> {
  const rows = listProtectionRows()
  const counts: Record<string, number> = { 待校验: 0, 运行正常: 0, 已校验: 0, 需更换: 0 }
  for (const row of rows) {
    const status = String(row.status)
    counts[status] = (counts[status] ?? 0) + 1
  }
  return counts
}

// 校验周期由装置专责核定
export function approveCheckCycle(
  id: number,
  cycle: string,
  approver: string,
  approvedDate = todayISO(),
): ActionResult {
  if (parseCycleYears(cycle) === null) {
    return { ok: false, message: '校验周期格式不合法，需为“1年/3年/6年”这样的整年周期' }
  }
  if (!approver.trim()) {
    return { ok: false, message: '校验周期由装置专责核定，请填写核定人' }
  }
  const rows = listProtectionRows()
  const index = rows.findIndex((row) => Number(row.id) === id)
  if (index < 0) {
    return { ok: false, message: `没有找到编号为 ${id} 的保护装置` }
  }
  const next = [...rows]
  next[index] = {
    ...rows[index],
    校验周期: cycle,
    周期核定人: approver.trim(),
    周期核定日: approvedDate,
  }
  saveRows(PROTECTION_KEY, next)
  reconcileCheckDate()
  return { ok: true, message: `校验周期已由${approver.trim()}核定为${cycle}` }
}

type CheckInput = {
  date: string
  verifier: string
  item: string
  passed: boolean
  actionValue?: string
  returnValue?: string
}

// 完成校验：登记一条保护校验记录，并把最近一次校验日回写到装置（单一数据源）。
// 校验判定合格的结论同步到定值整定的待整定清单。
export function completeDeviceCheck(id: number, input: CheckInput): ActionResult {
  if (!input.date) {
    return { ok: false, message: '请填写本次校验日期' }
  }
  if (!input.verifier.trim()) {
    return { ok: false, message: '请填写校验人' }
  }
  const devices = listProtectionRows()
  const index = devices.findIndex((row) => Number(row.id) === id)
  if (index < 0) {
    return { ok: false, message: `没有找到编号为 ${id} 的保护装置` }
  }
  const device = devices[index]
  if (String(device.status) === '需更换') {
    return { ok: false, message: '装置已进入需更换流程，不再安排校验' }
  }

  const tests = listRows(RELAYTEST_KEY)
  const testId = nextId(tests)
  const status = input.passed ? '校验合格' : '校验不合格'
  const testRow: EntryRow = {
    id: testId,
    status,
    pending: false,
    abnormal: !input.passed,
    校验编号: padId(testId, 'RELA'),
    所属变电站: String(device['所属变电站'] ?? ''),
    装置名称: String(device['装置编号']),
    装置型号: String(device['装置型号'] ?? ''),
    校验项目: input.item.trim() || '例行校验',
    动作值: input.actionValue?.trim() || (input.passed ? '动作值合格' : '动作值偏差超差'),
    返回值: input.returnValue?.trim() || (input.passed ? '返回值合格' : '返回值不合格'),
    校验人: input.verifier.trim(),
    校验日期: input.date,
    校验状态: status,
  }
  saveRows(RELAYTEST_KEY, [...tests, testRow])

  const updated = setDeviceRow(
    { ...device, 上次校验日: input.date },
    input.passed ? '已校验' : '待校验',
  )
  const nextDevices = [...devices]
  nextDevices[index] = updated
  saveRows(PROTECTION_KEY, nextDevices)
  reconcileCheckDate()

  let message = `校验记录 ${testRow['校验编号']} 已登记，装置状态「${updated.status}」，上次校验日更新为 ${input.date}`
  if (input.passed) {
    const sync = syncSettingFromCheck(String(device['装置编号']), input.date, testRow)
    message += sync.ok ? `；${sync.message}` : ''
  }
  return { ok: true, message }
}

export function registerDeviceRunning(id: number): ActionResult {
  const rows = listProtectionRows()
  const index = rows.findIndex((row) => Number(row.id) === id)
  if (index < 0) {
    return { ok: false, message: `没有找到编号为 ${id} 的保护装置` }
  }
  const current = String(rows[index].status)
  if (current === '需更换') {
    return { ok: false, message: '装置处于需更换状态，不能登记运行；请在更换申请闭环后登记新装置' }
  }
  if (current === '运行正常') {
    return { ok: false, message: '装置已经是「运行正常」，不用重复操作' }
  }
  const next = [...rows]
  next[index] = setDeviceRow(rows[index], '运行正常')
  saveRows(PROTECTION_KEY, next)
  reconcileCheckDate()
  return { ok: true, message: '保护装置已登记运行，当前状态「运行正常」' }
}

// ---------------------------------------------------------------------------
// 更换申请：同一台装置重复提交更换申请只落一条（存在申请中记录即拦下）。
// ---------------------------------------------------------------------------
export function listReplacementRequests(): EntryRow[] {
  return listRows(REPLACEMENT_KEY).sort((a, b) =>
    String(b['申请日期']).localeCompare(String(a['申请日期'])),
  )
}

export function submitReplacementRequest(
  id: number,
  reason: string,
  applicant: string,
  date = todayISO(),
): ActionResult {
  if (!reason.trim()) {
    return { ok: false, message: '请填写更换原因' }
  }
  if (!applicant.trim()) {
    return { ok: false, message: '请填写申请人' }
  }
  const devices = listProtectionRows()
  const index = devices.findIndex((row) => Number(row.id) === id)
  if (index < 0) {
    return { ok: false, message: `没有找到编号为 ${id} 的保护装置` }
  }
  const deviceNo = String(devices[index]['装置编号'])
  const requests = listRows(REPLACEMENT_KEY)
  const open = requests.some(
    (row) => String(row['装置编号']) === deviceNo && String(row.status) === '申请中',
  )
  if (open) {
    return { ok: false, message: `${deviceNo} 已存在申请中的更换申请，重复提交不再落单` }
  }

  const requestId = nextId(requests)
  const requestRow: EntryRow = {
    id: requestId,
    status: '申请中',
    pending: true,
    abnormal: false,
    申请编号: padId(requestId, 'REPL'),
    装置编号: deviceNo,
    所属变电站: String(devices[index]['所属变电站'] ?? ''),
    更换原因: reason.trim(),
    申请人: applicant.trim(),
    申请日期: date,
    处理备注: '',
    申请状态: '申请中',
  }
  saveRows(REPLACEMENT_KEY, [...requests, requestRow])

  // 装置进入需更换之后不再进待校验清单
  const nextDevices = [...devices]
  nextDevices[index] = setDeviceRow(devices[index], '需更换')
  saveRows(PROTECTION_KEY, nextDevices)
  reconcileCheckDate()
  return { ok: true, message: `更换申请 ${requestRow['申请编号']} 已提交，装置进入「需更换」` }
}

export function closeReplacementRequest(
  requestId: number,
  note: string,
  closedDate = todayISO(),
): ActionResult {
  const requests = listRows(REPLACEMENT_KEY)
  const index = requests.findIndex((row) => Number(row.id) === requestId)
  if (index < 0) {
    return { ok: false, message: `没有找到编号为 ${requestId} 的更换申请` }
  }
  if (String(requests[index].status) !== '申请中') {
    return { ok: false, message: '该更换申请已闭环，不用重复操作' }
  }
  const next = [...requests]
  next[index] = {
    ...requests[index],
    status: '已闭环',
    pending: false,
    处理备注: note.trim() || `已于 ${closedDate} 完成更换`,
    申请状态: '已闭环',
  }
  saveRows(REPLACEMENT_KEY, next)
  return { ok: true, message: `更换申请 ${next[index]['申请编号']} 已闭环` }
}

// ---------------------------------------------------------------------------
// 校验合格 → 定值整定待整定清单：同一装置的待整定同步单只保留一条。
// ---------------------------------------------------------------------------
function syncSettingFromCheck(deviceNo: string, checkDate: string, testRow: EntryRow): ActionResult {
  const settings = listRows(SETTING_KEY)
  const exists = settings.some(
    (row) =>
      String(row['所属装置']) === deviceNo &&
      String(row.status) === '待整定' &&
      String(row['计算依据'] ?? '').includes('校验合格'),
  )
  if (exists) {
    return { ok: false, message: `${deviceNo} 的待整定清单已存在同步项，不重复落单` }
  }
  const id = nextId(settings)
  const row: EntryRow = {
    id,
    status: '待整定',
    pending: true,
    abnormal: false,
    定值单号: padId(id, 'SETT'),
    所属装置: deviceNo,
    所属变电站: String(testRow['所属变电站'] ?? ''),
    定值项目: `校验后复核（${testRow['校验项目']}）`,
    整定值: '按现场校验值复核',
    计算依据: `${checkDate} 校验合格（${testRow['校验编号']}）同步`,
    整定人: '',
    审核人: '',
    定值状态: '待整定',
  }
  saveRows(SETTING_KEY, [...settings, row])
  return { ok: true, message: `已同步 ${row['定值单号']} 到定值整定待整定清单` }
}

// 保护校验页判定合格：走通用流转后，按装置编号对账最近校验日，并同步待整定清单。
export function runRelayTestAction(id: number, action: string): ActionResult {
  const result = runAction(RELAYTEST_KEY, id, action)
  if (!result.ok) {
    return result
  }
  const test = listRows(RELAYTEST_KEY).find((row) => Number(row.id) === id)
  reconcileCheckDate()
  if (action === '判定合格' && test) {
    const sync = syncSettingFromCheck(
      String(test['装置名称']),
      String(test['校验日期']),
      test,
    )
    if (sync.ok) {
      return { ...result, message: `${result.message}；${sync.message}` }
    }
  }
  return result
}

// 保护装置页的动作分发：三个状态动作都有领域约束，统一从这里走。
export function runDeviceAction(
  action: string,
  row: EntryRow,
  payload?: { reason?: string; applicant?: string },
): ActionResult {
  const id = Number(row.id)
  if (action === '登记运行') {
    return registerDeviceRunning(id)
  }
  if (action === '提出更换') {
    return submitReplacementRequest(
      id,
      payload?.reason ?? '',
      payload?.applicant ?? '值班管理员',
    )
  }
  if (action === '完成校验') {
    return { ok: false, message: '完成校验需填写校验日期与判定结论，请通过「登记校验结果」操作' }
  }
  return { ok: false, message: `保护装置没有登记「${action}」这个动作` }
}

export function runAction(key: string, id: number, action: string): ActionResult {
  const meta = moduleMeta(key)
  const target = meta.actionTargets[action]
  if (!target) {
    return { ok: false, message: `${meta.entity}没有登记「${action}」这个动作` }
  }
  const rows = listRows(key)
  const index = rows.findIndex((row) => Number(row.id) === id)
  if (index < 0) {
    return { ok: false, message: `没有找到编号为 ${id} 的${meta.entity}` }
  }
  const current = String(rows[index].status)
  if (current === target) {
    return { ok: false, message: `${meta.entity}已经是「${target}」，不用重复操作` }
  }
  const lastStatus = meta.statuses[meta.statuses.length - 1]
  const updated: EntryRow = {
    ...rows[index],
    status: target,
    pending: target !== lastStatus,
    abnormal: NEGATIVE_ACTIONS.some((verb) => action.startsWith(verb)),
  }
  const next = [...rows]
  next[index] = updated
  saveRows(key, next)
  return { ok: true, message: `${meta.entity}已${action}，当前状态「${target}」` }
}

export function resetModule(key: string): PageResult {
  resetRows(key)
  if (key === PROTECTION_KEY || key === RELAYTEST_KEY || key === SETTING_KEY || key === REPLACEMENT_KEY) {
    reconcileCheckDate()
  }
  return listEntries(key)
}

export function exportEntries(key: string): { filename: string; content: string } {
  const meta = moduleMeta(key)
  const rows = key === PROTECTION_KEY ? listProtectionRows() : listRows(key)
  const header = ['编号', ...meta.fields, '当前状态']
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push([row.id, ...meta.fields.map((field) => row[field] ?? ''), row.status].join(','))
  }
  return { filename: `${meta.name}-清单.csv`, content: `﻿${lines.join('\n')}` }
}

export function downloadEntries(key: string): void {
  const { filename, content } = exportEntries(key)
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function loadOverview(): OverviewResult {
  reconcileCheckDate()
  const rows = allRows()
  const modules = [...MODULE_BY_KEY.values()].map((meta) => {
    const entries = rows[meta.key] ?? []
    return {
      name: meta.name,
      created: entries.length,
      pending: entries.filter((row) => row.pending).length,
      abnormal: entries.filter((row) => row.abnormal).length,
    }
  })
  const cards = [
    { label: '业务模块', value: modules.length },
    { label: '登记总量', value: modules.reduce((sum, item) => sum + item.created, 0) },
    { label: '待处理', value: modules.reduce((sum, item) => sum + item.pending, 0) },
    { label: '异常量', value: modules.reduce((sum, item) => sum + item.abnormal, 0) },
  ]
  return { cards, modules }
}

// 供页面判断下次校验日/超期天数，列表与详情同一口径
export function deviceSchedule(row: EntryRow): { nextCheck: string; daysOverdue: number } {
  const next = nextCheckDate(
    String(row['上次校验日'] ?? ''),
    String(row['校验周期'] ?? ''),
    String(row['投运日期'] ?? ''),
  )
  const reference = todayISO()
  const overdue = next !== '' && String(row.status) !== '需更换' && next < reference
  return { nextCheck: next, daysOverdue: overdue ? daysBetween(next, reference) : 0 }
}
