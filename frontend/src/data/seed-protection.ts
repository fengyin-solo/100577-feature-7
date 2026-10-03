import type { EntryRow } from './types'
import { ALL_BAYS, DEVICE_MODELS, PROTECTION_TYPES } from './domain'
import type { ProtectionType } from './domain'
import { addMonths } from '../utils/date'

// 保护装置领域的示例数据生成：三百多台装置按所属间隔铺开，间隔、型号、保护类型
// 都取 domain.ts 里的统一口径；校验记录与定值单按装置编号关联。
// 生成过程不使用随机数，任何时候重置回来都是同一份数据。

const STATION = '云岭220kV变电站'
const VERIFIERS = ['保护班-王校验', '保护班-李校验', '继保专责-周工', '检修二班-陈工']
const SETTERS = ['整定人-赵明', '整定人-孙磊', '整定人-钱进']
const REVIEWERS = ['审核-继保专责', '审核-调度继保处']
const CHECK_ITEMS = ['全检', '部检', '首检', '例行校验']

// 确定性哈希：同一装置的各字段派生结果固定，重置后数据不漂移
function hash(id: number, salt: number): number {
  let value = (id * 2654435761 + salt * 40503) >>> 0
  value = (value ^ (value >>> 13)) >>> 0
  value = Math.imul(value, 1274126177) >>> 0
  return (value ^ (value >>> 16)) >>> 0
}

function padId(value: number, prefix: string): string {
  return `${prefix}-${String(value).padStart(4, '0')}`
}

type DeviceSlot = { bay: string; type: (typeof PROTECTION_TYPES)[number]; role: string }

function typeOfModel(model: string): (typeof PROTECTION_TYPES)[number] {
  const found = PROTECTION_TYPES.find((type) => DEVICE_MODELS[type].includes(model))
  return found ?? '其他保护'
}

// 每个间隔内的装置槽位：role 用于派生装置位号（A/B/C 套、操作箱等）
function baySlots(bay: string): DeviceSlot[] {
  if (/主变间隔/.test(bay)) {
    return [
      { bay, type: '主变保护', role: 'A套' },
      { bay, type: '主变保护', role: 'B套' },
      { bay, type: '主变保护', role: '非电量保护' },
    ]
  }
  // 形如「35kV 301线间隔」与「10kV 901城西I线间隔」的线路间隔
  if (/线间隔/.test(bay)) {
    return [
      { bay, type: '线路保护', role: 'A套' },
      { bay, type: '线路保护', role: 'B套' },
      { bay, type: '线路保护', role: '操作箱' },
    ]
  }
  if (/母联/.test(bay)) {
    return [
      { bay, type: '母联分段保护', role: '保护A套' },
      { bay, type: '母联分段保护', role: '操作箱' },
    ]
  }
  if (/分段/.test(bay)) {
    return [
      { bay, type: '母联分段保护', role: '保护A套' },
      { bay, type: '备自投', role: '备自投装置' },
      { bay, type: '母联分段保护', role: '操作箱' },
    ]
  }
  if (/电容器/.test(bay)) {
    return [
      { bay, type: '电容器保护', role: '保护装置' },
      { bay, type: '电容器保护', role: '操作箱' },
    ]
  }
  if (/电抗器/.test(bay)) {
    return [
      { bay, type: '电抗器保护', role: '保护装置' },
      { bay, type: '电抗器保护', role: '操作箱' },
    ]
  }
  if (/接地变/.test(bay)) {
    return [
      { bay, type: '站用变/接地变保护', role: '保护装置' },
      { bay, type: '站用变/接地变保护', role: '操作箱' },
    ]
  }
  if (/站用变/.test(bay)) {
    return [
      { bay, type: '站用变/接地变保护', role: '保护装置' },
      { bay, type: '备自投', role: '备自投装置' },
    ]
  }
  if (/PT间隔/.test(bay)) {
    // PT 间隔挂母线电压并列装置，型号与保护类型沿用母线保护口径
    return [{ bay, type: '母线保护', role: '母线电压并列装置' }]
  }
  return [{ bay, type: '其他保护', role: '保护装置' }]
}

type BuiltDevice = {
  row: EntryRow
  model: string
  commission: string
  cycleYears: number
}

// 特殊样例装置不写死编号，台账规模调整后仍然成立：
// 更换样例取 A 套老装置；冲突样例取校验史较长的老装置。
function pickReplacementIds(devices: BuiltDevice[]): number[] {
  const old = devices
    .filter((item) => item.cycleYears >= 3 && String(item.row['装置位号']) === 'A套')
    .sort((a, b) => String(a.row['装置编号']).localeCompare(String(b.row['装置编号'])))
  const step = Math.max(1, Math.floor(old.length / 5))
  return [0, 1, 2, 3].map((index) => Number(old[step * (index + 1)].row.id))
}

function pickConflictIds(devices: BuiltDevice[], exclude: number[]): number[] {
  const old = devices
    .filter(
      (item) =>
        !exclude.includes(Number(item.row.id)) &&
        String(item.row['上次校验日']) !== '' &&
        item.commission <= '2012-12-31',
    )
    .sort((a, b) => String(a.row['装置编号']).localeCompare(String(b.row['装置编号'])))
  const step = Math.max(1, Math.floor(old.length / 5))
  return [0, 1, 2, 3].map((index) => Number(old[step * (index + 1)].row.id))
}

function buildDevices(): { devices: BuiltDevice[]; replacementIds: number[] } {
  const devices: BuiltDevice[] = []
  let id = 0
  for (const bay of ALL_BAYS) {
    for (const slot of baySlots(bay)) {
      id += 1
      const models = DEVICE_MODELS[slot.type]
      const model = models[hash(id, 1) % models.length]
      // 投运年份：老站设备 2008~2025 不等，少量 2026 年新装置（首检）
      const year = 2008 + (hash(id, 2) % 19)
      const month = 1 + (hash(id, 3) % 12)
      const day = 1 + (hash(id, 4) % 27)
      const commission = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      let cycleYears = 6
      if (/220kV|110kV/.test(bay)) {
        cycleYears = hash(id, 5) % 4 === 0 ? 6 : 3
      }
      if (year >= 2025) {
        cycleYears = 1 // 新投装置先按 1 年首检周期，由装置专责核定
      }
      const cycle = `${cycleYears}年`

      // 少量装置从未校验（新装置），其余按周期反推上次校验日
      const neverChecked = year >= 2025 && hash(id, 6) % 3 !== 0
      let lastCheck = ''
      if (!neverChecked) {
        // 距上次校验 6~70 个月，刻意让一部分装置超期，进待校验清单
        const elapsed = 6 + (hash(id, 7) % 65)
        const candidate = addMonths('2026-10-03', -elapsed)
        // 上次校验不可能早于投运日期：算不出来就按首检未安排处理
        lastCheck = candidate >= commission ? candidate : ''
      }

      const verifierSeed = hash(id, 8)
      const approved = verifierSeed % 5 !== 0
      const approver = approved ? VERIFIERS[verifierSeed % VERIFIERS.length] : ''
      const approvedDate = approved ? addMonths(lastCheck || commission, 1) : ''

      const row: EntryRow = {
        id,
        status: '运行正常',
        pending: true,
        abnormal: false,
        装置编号: padId(id, 'PROT'),
        所属变电站: STATION,
        所属间隔: bay,
        装置型号: model,
        保护类型: slot.type,
        装置位号: slot.role,
        投运日期: commission,
        校验周期: cycle,
        周期核定人: approver,
        周期核定日: approvedDate,
        上次校验日: lastCheck,
        装置状态: '运行正常',
      }
      devices.push({ row, model, commission, cycleYears })
    }
  }

  const replacementIds = pickReplacementIds(devices)
  // 状态：个别装置需更换；新装置/超期装置待校验；约 1/3 近三个月刚校验完
  for (const item of devices) {
    const deviceId = Number(item.row.id)
    let status = '运行正常'
    if (replacementIds.includes(deviceId)) {
      status = '需更换'
    } else if (String(item.row['上次校验日']) >= '2026-07-01' && hash(deviceId, 9) % 3 === 0) {
      status = '已校验'
    } else {
      // 待校验口径与数据服务保持一致：到期日（无校验时取投运日+周期）早于今天
      const base = String(item.row['上次校验日'] || item.commission)
      const due = addMonths(base, item.cycleYears * 12)
      status = due < '2026-10-03' ? '待校验' : '运行正常'
    }
    item.row = {
      ...item.row,
      status,
      [DEVICE_STATUS_FIELD]: status,
      pending: status !== '需更换',
      abnormal: status === '需更换',
    }
  }
  return { devices, replacementIds }
}

const DEVICE_STATUS_FIELD = '装置状态'

function buildRelayTests(devices: BuiltDevice[], conflictIds: number[]): EntryRow[] {
  const rows: EntryRow[] = []
  let testId = 0
  for (const device of devices) {
    const last = String(device.row['上次校验日'] ?? '')
    if (!last) {
      continue
    }
    const count = 1 + (hash(device.row.id as number, 10) % 3) // 每台 1~3 条历史校验
    // 留几台刻意制造冲突：最新一条校验记录比台账「上次校验日」还晚，
    // 数据服务要按“最近一次校验记录为准”回写装置。
    const conflict = conflictIds.includes(device.row.id as number)
    for (let index = 0; index < count; index += 1) {
      const back = (count - 1 - index) * (12 + (hash(device.row.id as number, 11 + index) % 18))
      const date = conflict && index === count - 1
        ? addMonths('2026-10-03', -(1 + (hash(device.row.id as number, 19) % 3)))
        : addMonths(last, -back)
      // 校验不能发生在投运之前；冲突日也不能越过投运日，否则放弃这条记录
      if (date < device.commission) {
        continue
      }
      testId += 1
      const pass = hash(testId, 12) % 8 !== 0
      const status = pass ? '校验合格' : '校验不合格'
      rows.push({
        id: testId,
        status,
        pending: false,
        abnormal: !pass,
        校验编号: padId(testId, 'RELA'),
        所属变电站: STATION,
        装置名称: device.row['装置编号'] as string,
        装置型号: device.model,
        校验项目: CHECK_ITEMS[hash(testId, 13) % CHECK_ITEMS.length],
        动作值: pass ? '动作值合格' : '动作值偏差超差',
        返回值: pass ? '返回值合格' : '返回值不合格',
        校验人: VERIFIERS[hash(testId, 14) % VERIFIERS.length],
        校验日期: date,
        校验状态: status,
      })
    }
  }
  return rows.sort((a, b) => String(a['校验日期']).localeCompare(String(b['校验日期'])))
}

// 定值样例按保护类型挑装置，不写死装置编号
const SETTING_BLUEPRINTS: { type: ProtectionType; item: string; value: string; basis: string; status: string }[] = [
  { type: '线路保护', item: '电流Ⅰ段定值', value: '2400A / 0s', basis: '整定计算书 JS-2026-001', status: '待整定' },
  { type: '线路保护', item: '电流Ⅱ段定值', value: '1800A / 0.5s', basis: '整定计算书 JS-2026-001', status: '待整定' },
  { type: '线路保护', item: '距离Ⅰ段定值', value: '8.2Ω / 0s', basis: '整定计算书 JS-2026-004', status: '待整定' },
  { type: '主变保护', item: '差动保护定值', value: '启动电流0.6Ie', basis: '整定计算书 JS-2026-007', status: '整定中' },
  { type: '电容器保护', item: '过流Ⅰ段定值', value: '3600A / 0.3s', basis: '整定计算书 JS-2026-011', status: '待整定' },
  { type: '线路保护', item: '零序Ⅱ段定值', value: '480A / 0.9s', basis: '整定计算书 JS-2026-014', status: '已审核' },
  { type: '母联分段保护', item: '过流速断定值', value: '6000A / 0s', basis: '整定计算书 JS-2026-018', status: '待整定' },
  { type: '备自投', item: '备自投动作时限', value: '3.5s', basis: '整定计算书 JS-2026-022', status: '待整定' },
  { type: '电容器保护', item: '电容器过电压', value: '1.1Un / 60s', basis: '整定计算书 JS-2026-025', status: '整定中' },
  { type: '电抗器保护', item: '电抗器差动定值', value: '启动电流0.5Ie', basis: '整定计算书 JS-2026-028', status: '已作废' },
]

function buildSettings(devices: BuiltDevice[]): EntryRow[] {
  // 同一类型按顺序取不同装置，避免多条定值单挤在同一台装置上
  const cursor = new Map<string, number>()
  return SETTING_BLUEPRINTS.map((item, index) => {
    const id = index + 1
    const sameType = devices.filter(
      (device) => String(device.row['保护类型']) === item.type,
    )
    const offset = cursor.get(item.type) ?? 0
    cursor.set(item.type, offset + 1)
    const device = sameType[offset % sameType.length].row
    return {
      id,
      status: item.status,
      pending: item.status !== '已作废' && item.status !== '已审核',
      abnormal: item.status === '已作废',
      定值单号: padId(id, 'SETT'),
      所属装置: String(device['装置编号']),
      所属变电站: STATION,
      定值项目: item.item,
      整定值: item.value,
      计算依据: item.basis,
      整定人: item.status === '待整定' ? '' : SETTERS[id % SETTERS.length],
      审核人: item.status === '已审核' ? REVIEWERS[id % REVIEWERS.length] : '',
      定值状态: item.status,
    }
  })
}

const REPLACEMENT_REASONS = [
  '电源模块频繁告警，厂家无备件',
  '采样通道零漂长期偏大，校验不合格',
  '装置超期服役，插件老化',
  '背板烧蚀隐患',
]

function buildReplacements(replacementIds: number[], devices: BuiltDevice[]): EntryRow[] {
  // 前 4 条对应台账里标记需更换的装置（申请中）；
  // 另取一台不在需更换名单里的装置留一条已闭环记录（换新后投运）。
  const plans: { device: number; reason: string; status: string; note: string }[] = [
    ...replacementIds.map((device, index) => ({
      device,
      reason: REPLACEMENT_REASONS[index % REPLACEMENT_REASONS.length],
      status: '申请中',
      note: '',
    })),
    {
      device: Number(
        devices.find((item) => !replacementIds.includes(Number(item.row.id)) && String(item.row['装置位号']) === 'A套')!
          .row.id,
      ),
      reason: '液晶与按键失灵',
      status: '已闭环',
      note: '已更换为 PCS-931 并投运',
    },
  ]
  return plans.map((plan, index) => {
    const id = index + 1
    return {
      id,
      status: plan.status,
      pending: plan.status === '申请中',
      abnormal: false,
      申请编号: padId(id, 'REPL'),
      装置编号: padId(plan.device, 'PROT'),
      所属变电站: STATION,
      更换原因: plan.reason,
      申请人: VERIFIERS[id % VERIFIERS.length],
      申请日期: `2026-09-${String(10 + id).padStart(2, '0')}`,
      处理备注: plan.note,
      申请状态: plan.status,
    }
  })
}

const built = buildDevices()
const devices = built.devices
const replacementIds = built.replacementIds
const conflictIds = pickConflictIds(devices, replacementIds)

export const PROTECTION_SEED_ROWS: Record<string, EntryRow[]> = {
  protectiondevice: devices.map((item) => item.row),
  relaytest: buildRelayTests(devices, conflictIds),
  settingvalue: buildSettings(devices),
  replacementrequest: buildReplacements(replacementIds, devices),
}

export const PROTECTION_DEVICE_COUNT = devices.length
export const SEED_SPECIAL_IDS = { replacementIds, conflictIds }
