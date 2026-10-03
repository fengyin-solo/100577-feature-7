<template>
  <section class="page" data-module="relaytest">
    <header class="page-head">
      <div>
        <h2>保护校验管理</h2>
        <p class="page-desc">校验记录的保护类型沿用装置台账口径；装置进入「需更换」后不再进待校验清单，校验判定合格会同步到定值整定待整定清单。</p>
      </div>
      <div class="page-actions">
        <button class="btn primary" type="button" @click="openCreate">登记校验记录</button>
        <button class="btn" type="button" @click="exportRows">导出保护校验清单</button>
      </div>
    </header>

    <div class="stat-row">
      <article class="stat-card">
        <span class="stat-label">待校验（不含需更换装置）</span>
        <strong class="stat-value">{{ countByStatus['待校验'] ?? 0 }}</strong>
      </article>
      <article class="stat-card">
        <span class="stat-label">校验中</span>
        <strong class="stat-value">{{ countByStatus['校验中'] ?? 0 }}</strong>
      </article>
      <article class="stat-card">
        <span class="stat-label">校验合格</span>
        <strong class="stat-value">{{ countByStatus['校验合格'] ?? 0 }}</strong>
      </article>
      <article class="stat-card">
        <span class="stat-label">校验不合格</span>
        <strong class="stat-value">{{ countByStatus['校验不合格'] ?? 0 }}</strong>
      </article>
    </div>

    <p v-if="excludedRows.length" class="notice-bar">
      {{ excludedRows.length }} 条待校验记录因所属装置已进入「需更换」而挂起，不进待校验清单：
      <span v-for="row in excludedRows" :key="String(row.id)" class="chip">
        {{ row.校验编号 }} / {{ row.装置名称 }}
      </span>
    </p>

    <form class="filter-bar" @submit.prevent="reload">
      <label v-for="field in filterFields" :key="field" class="filter-item">
        <span>{{ field }}</span>
        <input v-model="filters[field]" :placeholder="`按${field}检索`" />
      </label>
      <label class="filter-item">
        <span>校验日期 起</span>
        <input v-model="dateFrom" type="date" />
      </label>
      <label class="filter-item">
        <span>校验日期 止</span>
        <input v-model="dateTo" type="date" />
      </label>
      <button class="btn" type="submit">查询</button>
      <button class="btn ghost" type="button" @click="resetFilters">重置条件</button>
    </form>

    <table class="data-table">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column">{{ column }}</th>
          <th>当前状态</th>
          <th>可执行动作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="String(row.id)">
          <td v-for="column in columns" :key="column">{{ row[column] ?? '—' }}</td>
          <td>{{ row.status }}</td>
          <td class="row-actions">
            <button
              v-if="row.status === '待校验'"
              class="link"
              type="button"
              @click="runRelay(row.id, '提交校验')"
            >
              提交校验
            </button>
            <button
              v-if="row.status === '校验中' || row.status === '待校验'"
              class="link"
              type="button"
              @click="runRelay(row.id, '判定合格')"
            >
              判定合格
            </button>
            <button
              v-if="row.status === '校验中' || row.status === '待校验'"
              class="link danger"
              type="button"
              @click="runRelay(row.id, '标记不合格')"
            >
              标记不合格
            </button>
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td :colspan="columns.length + 2" class="empty-state">暂无符合条件的保护校验记录</td>
        </tr>
      </tbody>
    </table>

    <footer class="page-foot">
      <span>共 {{ total }} 条保护校验记录</span>
      <span v-if="okMessage" class="ok-text">{{ okMessage }}</span>
      <span v-if="errorMessage" class="error-text">{{ errorMessage }}</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import { downloadEntries } from '@/api/local-service'
import { listRelayRows, runRelayAction } from '@/api/protection-service'
import { useFilterStore } from '@/stores/filters'
import type { EntryRow } from '@/data/types'

const FILTER_KEY = 'relaytest'
const filterStore = useFilterStore()

const columns = ['校验编号', '装置名称', '保护类型', '校验项目', '动作值', '返回值', '校验人', '校验日期']
const filterFields = ['校验编号', '装置名称', '保护类型', '校验项目', '校验人']

const rows = ref<EntryRow[]>([])
const excludedRows = ref<EntryRow[]>([])
const total = ref(0)
const errorMessage = ref('')
const okMessage = ref('')

const saved = filterStore.get(FILTER_KEY)
const filters = reactive<Record<string, string>>({
  ...Object.fromEntries(filterFields.map((field) => [field, ''])),
  ...saved,
})
const dateFrom = ref(String(saved.__dateFrom ?? ''))
const dateTo = ref(String(saved.__dateTo ?? ''))

const countByStatus = computed<Record<string, number>>(() => {
  const counter: Record<string, number> = {}
  for (const row of listRelayRows().items) {
    counter[String(row.status)] = (counter[String(row.status)] ?? 0) + 1
  }
  return counter
})

function resetFilters() {
  for (const field of filterFields) filters[field] = ''
  dateFrom.value = ''
  dateTo.value = ''
  filterStore.clear(FILTER_KEY)
  reload()
}

function exportRows() {
  downloadEntries(FILTER_KEY)
}

function openCreate() {
  errorMessage.value = '校验记录登记入口尚未接入审批流'
}

function runRelay(id: number, action: string) {
  const result = runRelayAction(id, action)
  reload()
  if (!result.ok) {
    errorMessage.value = result.message
    return
  }
  okMessage.value = result.message
}

function reload() {
  errorMessage.value = ''
  okMessage.value = ''
  try {
    const { items, excluded } = listRelayRows()
    excludedRows.value = excluded
    const pairs = Object.entries(filters).filter(([, value]) => value.trim() !== '')
    let matched = items.filter((row) =>
      pairs.every(([field, value]) => String(row[field] ?? '').includes(value.trim())),
    )
    if (dateFrom.value) matched = matched.filter((row) => String(row.校验日期) >= dateFrom.value)
    if (dateTo.value) matched = matched.filter((row) => String(row.校验日期) <= dateTo.value)
    rows.value = matched
    total.value = matched.length
    filterStore.set(FILTER_KEY, { ...filters, __dateFrom: dateFrom.value, __dateTo: dateTo.value })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '保护校验列表读取失败'
  }
}

reload()
</script>
