import { reactive, watch } from 'vue'

// 页面状态持久化：筛选、分片、分页这些条件放在 localStorage 里，
// 翻页、切走再回来、刷新浏览器都不丢。每个调用方用独立的 key 各存一份。
export function usePersistentState<T extends object>(key: string, initial: () => T): T {
  const storageKey = `substation-protection:ui:${key}`
  let restored: T
  try {
    const raw = window.localStorage.getItem(storageKey)
    restored = raw ? { ...initial(), ...(JSON.parse(raw) as T) } : initial()
  } catch {
    restored = initial()
  }
  const state = reactive(restored) as T
  watch(
    state,
    (value) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(value))
      } catch {
        // 存储不可用时退化为内存态，不影响筛选本身
      }
    },
    { deep: true },
  )
  return state
}
