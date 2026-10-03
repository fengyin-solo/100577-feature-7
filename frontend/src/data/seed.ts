import type { EntryRow } from './types'
import { OTHER_SEED_ROWS } from './seed-other'
import { PROTECTION_SEED_ROWS } from './seed-protection'

// 示例数据：首次打开时播种，之后浏览器里的改动优先，重置才会回到这份。
// 保护装置、保护校验、定值整定与更换申请由 seed-protection 按台账关系生成；
// 其余模块沿用 seed-other 里的样例记录。
export const SEED_ROWS: Record<string, EntryRow[]> = {
  ...OTHER_SEED_ROWS,
  ...PROTECTION_SEED_ROWS,
}
