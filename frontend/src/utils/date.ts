/** 日期工具：全部按 YYYY-MM-DD 字符串比较，区间筛选不用转时间戳。 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function todayISO(): string {
  const now = new Date()
  return toISO(now)
}

export function toISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isValidISODate(value: string): boolean {
  if (!ISO_DATE.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/** 在某月基准上整月平移，结果日溢出当月时夹到月末（如 3/31 + 1 月 = 4/30）。 */
export function addMonths(value: string, months: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const target = new Date(year, month - 1 + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, lastDay))
  return toISO(target)
}

export function addYears(value: string, years: number): string {
  return addMonths(value, years * 12)
}

/** 「校验周期」字段形如「3年」，解析不出来返回 null。 */
export function parseCycleYears(cycle: string): number | null {
  const matched = String(cycle ?? '').match(/^(\d+)\s*年$/)
  if (!matched) {
    return null
  }
  const years = Number(matched[1])
  return years > 0 ? years : null
}

/** 下次校验日 = 上次校验日 + 校验周期；没有上次校验日（新装置首检）时用投运日期。 */
export function nextCheckDate(lastCheck: string, cycle: string, commissionDate: string): string {
  const years = parseCycleYears(cycle)
  if (years === null) {
    return ''
  }
  const base = lastCheck || commissionDate
  if (!base) {
    return ''
  }
  return addYears(base, years)
}
