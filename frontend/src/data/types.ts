/** 纯前端数据层的公共类型：与全栈版后端返回的结构保持一致，换回后端时页面不用改。 */

export type EntryRow = {
  id: number
  status: string
  pending: boolean
  abnormal: boolean
  [field: string]: string | number | boolean
}

export type ModuleMeta = {
  key: string
  name: string
  entity: string
  desc: string
  fields: string[]
  statuses: string[]
  actions: string[]
  actionTargets: Record<string, string>
  metrics: string[]
}

export type PageResult = {
  items: EntryRow[]
  total: number
  page: number
  size: number
}

export type ActionResult = {
  ok: boolean
  message: string
}

export type OverviewResult = {
  cards: { label: string; value: number }[]
  modules: { name: string; created: number; pending: number; abnormal: number }[]
}

// 保护装置定位条件：装置编号/装置型号/保护类型是叠加取交集的等值或包含匹配，
// 上次校验日按起止闭区间过滤。
export type DeviceFilters = {
  bay: string
  deviceNo: string
  model: string
  protectionType: string
  checkFrom: string
  checkTo: string
}

// 每条筛选条件单独给出在当前分片里的命中数；全量为 0 时据此点明是哪一格没对上。
export type FilterCell = {
  key: keyof DeviceFilters | 'combined'
  label: string
  value: string
  active: boolean
  hits: number
  matched: boolean
}

export type DevicePageResult = {
  items: EntryRow[]
  total: number
  page: number
  size: number
  cells: FilterCell[]
  bayGroups: { group: string; bays: { bay: string; count: number; overdue: number }[] }[]
  groupCounts: { group: string; count: number; overdue: number }[]
}

export type PendingDevice = {
  row: EntryRow
  nextCheck: string
  daysOverdue: number
}

export type ReplacementRequest = EntryRow

export type DeviceDetail = {
  device: EntryRow
  nextCheck: string
  daysOverdue: number
  relayTests: EntryRow[]
  replacements: EntryRow[]
  settings: EntryRow[]
}

