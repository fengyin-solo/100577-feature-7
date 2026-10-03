import { defineStore } from 'pinia'

// 各列表页的筛选条件存在这里并落到 localStorage：刷新页面、切到别的菜单再回来，条件都不丢。
const STORAGE_KEY = 'substation-protection:filters:v1'

function load(): Record<string, Record<string, string>> {
  if (typeof window === 'undefined' || !window.localStorage) return {}
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<
      string,
      Record<string, string>
    >
  } catch {
    return {}
  }
}

export const useFilterStore = defineStore('filter', {
  state: () => ({ saved: load() }),
  actions: {
    get(key: string): Record<string, string> {
      return this.saved[key] ?? {}
    },
    set(key: string, value: Record<string, string>) {
      this.saved = { ...this.saved, [key]: value }
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.saved))
      }
    },
    clear(key: string) {
      const next = { ...this.saved }
      delete next[key]
      this.saved = next
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      }
    },
  },
})
