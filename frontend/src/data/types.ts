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

/** 保护装置筛选条件：文本字段做包含匹配并叠加取交集，上次校验日走起止区间。 */
export type DeviceFilter = {
  装置编号: string
  所属间隔: string
  装置型号: string
  保护类型: string
  校验日起: string
  校验日止: string
}

/** 一条都没命中时，逐格说明每个条件卡掉了多少台。 */
export type FilterMismatch = {
  label: string
  expected: string
  aloneHits: number
}

/** 列表与详情面板共用的装置视图：上次校验日经校验记录口径校正后唯一一份。 */
export type DeviceView = EntryRow & {
  上次校验日: string
  上次校验日来源: string
}

export type Shard = {
  bay: string
  items: DeviceView[]
}

export type DeviceQueryResult = {
  items: DeviceView[]
  total: number
  shards: Shard[]
  mismatch: FilterMismatch[]
}

export type DeviceDetail = {
  device: DeviceView
  relays: EntryRow[]
  replacements: EntryRow[]
}
