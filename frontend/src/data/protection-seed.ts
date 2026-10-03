import type { EntryRow } from './types'

// 保护相关模块的示例数据在这里统一生成：保护装置三百余台、保护校验记录、定值单与更换申请。
// 用固定种子的伪随机数生成，刷新播种结果稳定；装置按「站+电压等级+间隔」组织。

type Spec = { bay: string; level: string; ptype: string; model: string }

function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const rnd = createRandom(20261003)
function pickOne<T>(list: T[]): T {
  return list[Math.floor(rnd() * list.length)]
}

const specs: Spec[] = []

function add(bay: string, level: string, ptype: string, models: string[]) {
  specs.push({ bay, level, ptype, model: pickOne(models) })
}

function addLine(station: string, level: string, name: string, models: string[], dual = false) {
  const bay = `${station}${level}${name}间隔`
  add(bay, level, '线路保护', models)
  if (dual) {
    add(bay, level, '线路保护', models)
  }
}

function addBank(
  station: string,
  level: string,
  kind: string,
  serial: number,
  ptype: string,
  models: string[],
) {
  add(`${station}${level}#${serial}${kind}间隔`, level, ptype, models)
}

// ---- 220kV 云山变电站 ----
const yunshan220 = ['云天线', '云石线', '云东线', '云茂线', '云城线', '云港线']
yunshan220.forEach((name) => addLine('云山站', '220kV', name, ['CSC-103', 'PSL-602', 'RCS-931'], true))
add('云山站220kV母联间隔', '220kV', '母联保护', ['CSC-122', 'PSL-631'])
add('云山站220kVⅠ母间隔', '220kV', '母线保护', ['CSC-150', 'BP-2B'])
add('云山站220kVⅡ母间隔', '220kV', '母线保护', ['CSC-150', 'BP-2B'])
;[1, 2].forEach((n) => {
  const bay = `云山站#${n}主变间隔`
  add(bay, '220kV', '主变保护', ['CSC-326', 'RCS-978'])
  add(bay, '220kV', '主变保护', ['CSC-326', 'RCS-978'])
})
const yunshan110 = ['云临线', '云新线', '云塘线', '云燕线', '云凤线', '云岗线', '云桥线', '云荔线', '云杉线', '云松线']
yunshan110.forEach((name) => addLine('云山站', '110kV', name, ['CSC-161', 'PSL-641', 'RCS-941']))
add('云山站110kV母联间隔', '110kV', '母联保护', ['CSC-122', 'PSL-631'])
add('云山站110kV母联备自投间隔', '110kV', '备自投保护', ['CSC-246', 'PCS-9651'])
add('云山站110kV进线备自投间隔', '110kV', '备自投保护', ['CSC-246', 'PCS-9651'])
add('云山站110kV母线间隔', '110kV', '母线保护', ['CSC-150'])
for (let n = 1; n <= 6; n += 1) addBank('云山站', '35kV', '电容器', n, '电容器保护', ['PCS-9631', 'CSC-221'])
for (let n = 1; n <= 2; n += 1) addBank('云山站', '35kV', '站用变', n, '站用变保护', ['PCS-9621'])
for (let n = 1; n <= 2; n += 1) addBank('云山站', '35kV', '电抗器', n, '电抗器保护', ['PCS-9626C', 'CSC-224'])
for (let n = 1; n <= 4; n += 1) addBank('云山站', '35kV', '接地变', n, '接地变保护', ['PCS-9626', 'CSC-221B'])
add('云山站35kV分段间隔', '35kV', '母联保护', ['CSC-122'])
for (let n = 1; n <= 24; n += 1) addLine('云山站', '10kV', `F${String(n).padStart(2, '0')}馈线`, ['PCS-9611', 'NSR-3697', 'NSP-40'])
for (let n = 1; n <= 6; n += 1) addBank('云山站', '10kV', '电容器', n, '电容器保护', ['PCS-9631', 'CSC-221'])
for (let n = 1; n <= 2; n += 1) addBank('云山站', '10kV', '接地变', n, '接地变保护', ['PCS-9626'])
for (let n = 1; n <= 2; n += 1) addBank('云山站', '10kV', '站用变', n, '站用变保护', ['PCS-9621'])
add('云山站10kVⅠ段分段间隔', '10kV', '母联保护', ['CSC-122'])
add('云山站10kVⅡ段分段间隔', '10kV', '母联保护', ['CSC-122'])
add('云山站10kV母联备自投间隔', '10kV', '备自投保护', ['CSC-246'])
add('云山站10kV进线备自投间隔', '10kV', '备自投保护', ['CSC-246'])

// ---- 110kV 临江变电站 ----
const linjiang110 = ['临江线', '临海线', '临浦线', '临桥线', '临塘线', '临燕线', '临港线', '临石线']
linjiang110.forEach((name) => addLine('临江站', '110kV', name, ['CSC-161', 'PSL-641', 'RCS-941']))
add('临江站110kV母联间隔', '110kV', '母联保护', ['CSC-122', 'PSL-631'])
add('临江站110kV母联备自投间隔', '110kV', '备自投保护', ['CSC-246', 'PCS-9651'])
add('临江站110kV进线备自投间隔', '110kV', '备自投保护', ['CSC-246', 'PCS-9651'])
add('临江站110kV母线间隔', '110kV', '母线保护', ['CSC-150'])
;[1, 2].forEach((n) => {
  const bay = `临江站#${n}主变间隔`
  add(bay, '110kV', '主变保护', ['CSC-326', 'RCS-978'])
  add(bay, '110kV', '主变保护', ['CSC-326', 'RCS-978'])
})
const linjiang35 = ['江凤线', '江塘线', '江茂线', '江荔线', '江石线', '江杉线', '江燕线', '江岗线']
linjiang35.forEach((name) => addLine('临江站', '35kV', name, ['CSC-211', 'PSL-691']))
add('临江站35kV母联间隔', '35kV', '母联保护', ['CSC-122'])
add('临江站35kV备自投间隔', '35kV', '备自投保护', ['CSC-246'])
for (let n = 1; n <= 4; n += 1) addBank('临江站', '35kV', '电容器', n, '电容器保护', ['PCS-9631', 'CSC-221'])
for (let n = 1; n <= 2; n += 1) addBank('临江站', '35kV', '接地变', n, '接地变保护', ['PCS-9626'])
for (let n = 1; n <= 30; n += 1) addLine('临江站', '10kV', `F${String(n).padStart(2, '0')}馈线`, ['PCS-9611', 'NSR-3697', 'NSP-40'])
for (let n = 1; n <= 6; n += 1) addBank('临江站', '10kV', '电容器', n, '电容器保护', ['PCS-9631', 'CSC-221'])
for (let n = 1; n <= 4; n += 1) addBank('临江站', '10kV', '接地变', n, '接地变保护', ['PCS-9626'])
for (let n = 1; n <= 2; n += 1) addBank('临江站', '10kV', '站用变', n, '站用变保护', ['PCS-9621'])
for (let n = 1; n <= 2; n += 1) addBank('临江站', '10kV', '电抗器', n, '电抗器保护', ['PCS-9626C'])
add('临江站10kVⅠ段分段间隔', '10kV', '母联保护', ['CSC-122'])
add('临江站10kVⅡ段分段间隔', '10kV', '母联保护', ['CSC-122'])
add('临江站10kV母联备自投间隔', '10kV', '备自投保护', ['CSC-246'])
add('临江站10kV进线备自投间隔', '10kV', '备自投保护', ['CSC-246'])

// ---- 110kV 新港变电站 ----
const xingang110 = ['港云线', '港桥线', '港塘线', '港茂线', '港石线', '港凤线']
xingang110.forEach((name) => addLine('新港站', '110kV', name, ['CSC-161', 'PSL-641', 'RCS-941']))
add('新港站110kV母联间隔', '110kV', '母联保护', ['CSC-122', 'PSL-631'])
add('新港站110kV母联备自投间隔', '110kV', '备自投保护', ['CSC-246', 'PCS-9651'])
add('新港站110kV进线备自投间隔', '110kV', '备自投保护', ['CSC-246', 'PCS-9651'])
add('新港站110kV母线间隔', '110kV', '母线保护', ['CSC-150'])
;[1, 2].forEach((n) => {
  const bay = `新港站#${n}主变间隔`
  add(bay, '110kV', '主变保护', ['CSC-326', 'RCS-978'])
  add(bay, '110kV', '主变保护', ['CSC-326', 'RCS-978'])
})
for (let n = 1; n <= 36; n += 1) addLine('新港站', '10kV', `F${String(n).padStart(2, '0')}馈线`, ['PCS-9611', 'NSR-3697', 'NSP-40'])
for (let n = 1; n <= 8; n += 1) addBank('新港站', '10kV', '电容器', n, '电容器保护', ['PCS-9631', 'CSC-221'])
for (let n = 1; n <= 4; n += 1) addBank('新港站', '10kV', '接地变', n, '接地变保护', ['PCS-9626'])
for (let n = 1; n <= 2; n += 1) addBank('新港站', '10kV', '站用变', n, '站用变保护', ['PCS-9621'])
add('新港站10kVⅠ段分段间隔', '10kV', '母联保护', ['CSC-122'])
add('新港站10kVⅡ段分段间隔', '10kV', '母联保护', ['CSC-122'])
add('新港站10kV母联备自投间隔', '10kV', '备自投保护', ['CSC-246'])
add('新港站10kV进线备自投间隔', '10kV', '备自投保护', ['CSC-246'])

// ---- 35kV 滨海变电站 ----
const binhai35 = ['海滨线', '海塘线', '海桥线', '海燕线', '海石线', '海茂线', '海荔线', '海凤线', '海岗线', '海浦线', '海杉线', '海港线']
binhai35.forEach((name) => addLine('滨海站', '35kV', name, ['CSC-211', 'PSL-691', 'NSR-3697']))
add('滨海站35kV分段间隔', '35kV', '母联保护', ['CSC-122'])
add('滨海站35kV备自投间隔', '35kV', '备自投保护', ['CSC-246'])
for (let n = 1; n <= 4; n += 1) addBank('滨海站', '35kV', '电容器', n, '电容器保护', ['PCS-9631', 'CSC-221'])
for (let n = 1; n <= 2; n += 1) addBank('滨海站', '35kV', '站用变', n, '站用变保护', ['PCS-9621'])
for (let n = 1; n <= 40; n += 1) addLine('滨海站', '10kV', `F${String(n).padStart(2, '0')}馈线`, ['PCS-9611', 'NSR-3697', 'NSP-40'])
for (let n = 1; n <= 6; n += 1) addBank('滨海站', '10kV', '电容器', n, '电容器保护', ['PCS-9631', 'CSC-221'])
for (let n = 1; n <= 4; n += 1) addBank('滨海站', '10kV', '接地变', n, '接地变保护', ['PCS-9626'])
for (let n = 1; n <= 2; n += 1) addBank('滨海站', '10kV', '站用变', n, '站用变保护', ['PCS-9621'])
add('滨海站10kVⅠ段分段间隔', '10kV', '母联保护', ['CSC-122'])
add('滨海站10kVⅡ段分段间隔', '10kV', '母联保护', ['CSC-122'])
add('滨海站10kV母联备自投间隔', '10kV', '备自投保护', ['CSC-246'])
add('滨海站10kV进线备自投间隔', '10kV', '备自投保护', ['CSC-246'])

const assignees = ['李建国', '王海涛', '张志强', '陈晓东', '刘明远', '赵伟', '孙磊', '周鹏']

function dateIn(startYear: number, endYear: number): string {
  const year = startYear + Math.floor(rnd() * (endYear - startYear + 1))
  const month = 1 + Math.floor(rnd() * 12)
  const day = 1 + Math.floor(rnd() * 28)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function shiftDays(iso: string, delta: number): string {
  const t = new Date(`${iso}T00:00:00Z`).getTime() + delta * 86400000
  return new Date(t).toISOString().slice(0, 10)
}

// 需更换装置散布在各站，其中一部分已提交过更换申请。
const replaceIds = [17, 63, 109, 152, 201, 244, 278, 305].filter((id) => id <= specs.length)

const devices: EntryRow[] = specs.map((spec, index) => {
  const id = index + 1
  const code = `PROT-${String(id).padStart(4, '0')}`
  const replaced = replaceIds.includes(id)
  let status = '运行正常'
  if (replaced) {
    status = '需更换'
  } else if (rnd() < 0.16) {
    status = '待校验'
  } else if (rnd() < 0.5) {
    status = '已校验'
  }
  const runDate = dateIn(2006, 2023)
  let lastDate: string
  if (status === '待校验') {
    lastDate = dateIn(2019, 2023)
  } else if (replaced) {
    lastDate = dateIn(2018, 2022)
  } else {
    lastDate = dateIn(2024, 2026)
    if (lastDate > '2026-09-20') lastDate = '2026-09-12'
  }
  return {
    id,
    status,
    pending: status === '待校验',
    abnormal: false,
    装置编号: code,
    所属间隔: spec.bay,
    装置型号: spec.model,
    保护类型: spec.ptype,
    投运日期: runDate,
    校验周期: spec.level === '10kV' || spec.level === '35kV' ? '3年' : pickOne(['6年', '6年', '3年']),
    装置专责: pickOne(assignees),
    上次校验日: lastDate,
    装置状态: status,
  }
})

// ---- 保护校验记录：装置名称沿用装置编号，保护类型沿用装置台账口径 ----
const testers = ['吴刚', '郑勇', '何军', '邓涛', '冯斌', '蒋涛']
const relayTests: EntryRow[] = []
function addRelay(device: EntryRow, status: string, date: string) {
  const ptype = String(device.保护类型)
  relayTests.push({
    id: relayTests.length + 1,
    status,
    pending: status === '待校验' || status === '校验中',
    abnormal: status === '校验不合格',
    校验编号: `RELA-${String(relayTests.length + 1).padStart(4, '0')}`,
    装置名称: String(device.装置编号),
    保护类型: ptype,
    校验项目: `${ptype}${rnd() < 0.5 ? '全部检验' : '部分检验'}`,
    动作值: `${(4.6 + rnd() * 1.1).toFixed(2)} A`,
    返回值: `${(4.1 + rnd() * 0.8).toFixed(2)} A`,
    校验人: pickOne(testers),
    校验日期: date,
    校验状态: status,
  })
}

// 先安排两条挂在需更换装置上的待校验记录，用于演示「不再进待校验清单」。
addRelay(devices[replaceIds[0] - 1], '待校验', '2026-09-18')
addRelay(devices[replaceIds[2] - 1], '待校验', '2026-09-22')
for (let i = 0; i < 12; i += 1) {
  const device = pickOne(devices.filter((row) => row.status !== '需更换'))
  addRelay(device, '待校验', dateIn(2026, 2026) > '2026-09-25' ? '2026-09-20' : dateIn(2026, 2026))
}
for (let i = 0; i < 96; i += 1) {
  const device = pickOne(devices)
  const roll = rnd()
  const status = roll < 0.62 ? '校验合格' : roll < 0.8 ? '校验中' : roll < 0.9 ? '校验不合格' : '待校验'
  addRelay(device, status, dateIn(2024, 2026))
}

// 台账上次校验日与校验记录冲突时，以最近一次校验记录为准：
// 若台账日期不晚于最近校验日，回退台账日期，制造可核对的冲突样例。
const latestByDevice = new Map<string, EntryRow>()
for (const record of relayTests) {
  const code = String(record.装置名称)
  const prev = latestByDevice.get(code)
  if (!prev || String(record.校验日期) >= String(prev.校验日期)) {
    latestByDevice.set(code, record)
  }
}
for (const device of devices) {
  const latest = latestByDevice.get(String(device.装置编号))
  if (latest && String(device.上次校验日) <= String(latest.校验日期)) {
    device.上次校验日 = shiftDays(String(latest.校验日期), -410)
  }
}

// ---- 定值整定：一部分由校验合格结论同步而来 ----
const settingValues: EntryRow[] = []
const qualified = relayTests.filter((row) => row.status === '校验合格')
function codeOf(deviceId: string) {
  return devices.find((row) => String(row.装置编号) === deviceId)
}
const syncedSeeds = qualified.slice(0, 5)
syncedSeeds.forEach((record, index) => {
  const device = codeOf(String(record.装置名称))
  settingValues.push({
    id: settingValues.length + 1,
    status: '待整定',
    pending: true,
    abnormal: false,
    定值单号: `SETT-${String(index + 1).padStart(4, '0')}`,
    所属装置: String(record.装置名称),
    定值项目: `${device ? String(device.保护类型) : '线路保护'}定值复核`,
    整定值: '依据校验结论复核整定',
    计算依据: '校验合格自动同步',
    整定人: '',
    审核人: '',
    定值状态: '待整定',
    来源校验编号: String(record.校验编号),
  })
})
const manualSettings: Array<[string, string, string, string]> = [
  ['整定中', 'PROT-0005', '距离Ⅰ段', '王海涛'],
  ['已审核', 'PROT-0012', '差动保护定值', '张志强'],
  ['已作废', 'PROT-0020', '过流Ⅱ段', '陈晓东'],
]
manualSettings.forEach(([status, deviceCode, item, setter], offset) => {
  const device = codeOf(deviceCode)
  settingValues.push({
    id: settingValues.length + 1,
    status,
    pending: status === '整定中',
    abnormal: false,
    定值单号: `SETT-${String(syncedSeeds.length + offset + 1).padStart(4, '0')}`,
    所属装置: deviceCode,
    定值项目: item,
    整定值: '见整定计算书',
    计算依据: '年度整定计算',
    整定人: setter,
    审核人: status === '已审核' ? '刘明远' : '',
    定值状态: status,
    来源校验编号: '',
  })
  void device
})

// ---- 更换申请：同一装置只允许一条，预置其中一部分 ----
const replacements: EntryRow[] = replaceIds.slice(0, 4).map((deviceId, index) => {
  const device = devices[deviceId - 1]
  return {
    id: index + 1,
    status: '待处理',
    pending: true,
    abnormal: false,
    申请单号: `REPL-${String(index + 1).padStart(4, '0')}`,
    装置编号: String(device.装置编号),
    所属间隔: String(device.所属间隔),
    装置型号: String(device.装置型号),
    申请原因: '超期服役、插件老化，校验多次告警',
    申请人: String(device.装置专责),
    申请日期: `2026-09-${String(10 + index * 3).padStart(2, '0')}`,
    处理状态: '待处理',
  }
})

export const PROTECTION_SEED = {
  devices,
  relayTests,
  settingValues,
  replacements,
  bayCount: new Set(specs.map((spec) => spec.bay)).size,
}
