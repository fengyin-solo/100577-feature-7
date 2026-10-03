<template>
  <section class="page" data-module="protectiondevice">
    <header class="page-head">
      <div>
        <h2>保护装置台账管理</h2>
        <p class="page-desc">三百余台保护装置按所属间隔分片维护；装置编号、装置型号、保护类型可叠加取交集定位，上次校验日按起止区间过滤。</p>
      </div>
      <div class="page-actions">
        <button class="btn primary" type="button" @click="openCreate">登记保护装置</button>
        <button class="btn" type="button" @click="exportRows">导出保护装置台账清单</button>
      </div>
    </header>

    <div class="stat-row">
      <article class="stat-card">
        <span class="stat-label">装置总数 / 所属间隔</span>
        <strong class="stat-value">{{ stats.total }} <small>台 / {{ stats.shards }} 个间隔</small></strong>
      </article>
      <article class="stat-card">
        <span class="stat-label">待校验（不含需更换）</span>
        <strong class="stat-value">{{ stats.pending }}</strong>
      </article>
      <article class="stat-card">
        <span class="stat-label">运行正常 / 已校验</span>
        <strong class="stat-value">{{ stats.normal }} / {{ stats.checked }}</strong>
      </article>
      <article class="stat-card">
        <span class="stat-label">需更换（含已申请）</span>
        <strong class="stat-value">{{ stats.replace }}</strong>
      </article>
    </div>

    <nav class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}<em v-if="tab.count !== null" class="tab-count">{{ tab.count }}</em>
      </button>
    </nav>

    <!-- 间隔分片台账 + 定位筛选 -->
    <div v-if="activeTab === 'shards'">
      <form class="filter-bar" @submit.prevent="applyFilter">
        <label class="filter-item">
          <span>装置编号</span>
          <input v-model="filter.装置编号" placeholder="如 PROT-0101" />
        </label>
        <label class="filter-item">
          <span>所属间隔</span>
          <input v-model="filter.所属间隔" placeholder="如 云山站110kV云临线间隔" list="bay-list" />
        </label>
        <label class="filter-item">
          <span>装置型号</span>
          <input v-model="filter.装置型号" placeholder="如 CSC-161" list="model-list" />
        </label>
        <label class="filter-item">
          <span>保护类型</span>
          <select v-model="filter.保护类型">
            <option value="">全部保护类型</option>
            <option v-for="item in typeOptions" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <label class="filter-item">
          <span>上次校验日 起</span>
          <input v-model="filter.校验日起" type="date" />
        </label>
        <label class="filter-item">
          <span>上次校验日 止</span>
          <input v-model="filter.校验日止" type="date" />
        </label>
        <button class="btn primary" type="submit">查询</button>
        <button class="btn ghost" type="button" @click="resetFilter">重置条件</button>
        <button class="btn ghost" type="button" @click="toggleAllShards">
          {{ collapsedAll ? '展开全部分片' : '折叠全部分片' }}
        </button>
      </form>
      <datalist id="bay-list">
        <option v-for="bay in bayOptions" :key="bay" :value="bay" />
      </datalist>
      <datalist id="model-list">
        <option v-for="model in modelOptionList" :key="model" :value="model" />
      </datalist>

      <p class="filter-summary" v-if="hasCondition">
        当前叠加条件：
        <span v-for="chip in activeChips" :key="chip" class="chip">{{ chip }}</span>
        共命中 <strong>{{ result.total }}</strong> 台，分布在 {{ result.shards.length }} 个间隔
      </p>

      <div v-if="result.total" class="shard-list">
        <section v-for="shard in result.shards" :key="shard.bay" class="shard">
          <header class="shard-head" @click="toggleShard(shard.bay)">
            <span class="shard-caret">{{ collapsedShards.has(shard.bay) ? '▶' : '▼' }}</span>
            <strong>{{ shard.bay }}</strong>
            <span class="shard-count">{{ shard.items.length }} 台</span>
          </header>
          <table v-if="!collapsedShards.has(shard.bay)" class="data-table shard-table">
            <thead>
              <tr>
                <th v-for="column in shardColumns" :key="column">{{ column }}</th>
                <th>当前状态</th>
                <th>可执行动作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in shard.items" :key="String(row.id)">
                <td v-for="column in shardColumns" :key="column">
                  {{ row[column] ?? '—' }}
                  <em v-if="column === '上次校验日'" class="source-hint" :title="row.上次校验日来源">
                    {{ row.上次校验日来源 === '台账登记' ? '台账' : '以校验记录为准' }}
                  </em>
                </td>
                <td>{{ row.status }}</td>
                <td class="row-actions">
                  <button class="link" type="button" @click="openDetail(row.id)">详情</button>
                  <button class="link" type="button" @click="openCycle(row.id)">核定周期</button>
                  <button
                    v-if="row.status === '待校验'"
                    class="link"
                    type="button"
                    @click="openComplete(row.id)"
                  >
                    完成校验
                  </button>
                  <button v-if="row.status !== '需更换'" class="link" type="button" @click="openReplace(row.id)">
                    提出更换
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <div v-else class="empty-state-box">
        <p>没有一条装置命中当前条件，逐格核对如下（各条件单独检索的命中数）：</p>
        <table class="data-table mismatch-table">
          <thead>
            <tr>
              <th>没对上的条件格</th>
              <th>期望值</th>
              <th>该条件单独命中</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in result.mismatch" :key="item.label" :class="{ zero: item.aloneHits === 0 }">
              <td>{{ item.label }}</td>
              <td>{{ item.expected }}</td>
              <td>{{ item.aloneHits }} 台</td>
              <td>
                {{ item.aloneHits === 0 ? '这一格单独检索就为 0，先改这里' : '这一格本身有命中，是与其他条件叠加后清零的' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 待校验清单：需更换装置不再进入 -->
    <div v-else-if="activeTab === 'pending'">
      <p class="status-legend">
        以下为状态「待校验」的装置；已进入「需更换」的装置不再出现在本清单。
      </p>
      <table class="data-table">
        <thead>
          <tr>
            <th v-for="column in pendingColumns" :key="column">{{ column }}</th>
            <th>当前状态</th>
            <th>可执行动作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in pendingRows" :key="String(row.id)">
            <td v-for="column in pendingColumns" :key="column">{{ row[column] ?? '—' }}</td>
            <td>{{ row.status }}</td>
            <td class="row-actions">
              <button class="link" type="button" @click="openDetail(row.id)">详情</button>
              <button class="link" type="button" @click="openComplete(row.id)">完成校验</button>
              <button class="link" type="button" @click="openReplace(row.id)">提出更换</button>
            </td>
          </tr>
          <tr v-if="!pendingRows.length">
            <td :colspan="pendingColumns.length + 2" class="empty-state">待校验清单为空</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 更换申请：同一装置只落一条 -->
    <div v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th v-for="column in replacementColumns" :key="column">{{ column }}</th>
            <th>处理状态</th>
            <th>可执行动作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in replacementRows" :key="String(row.id)">
            <td v-for="column in replacementColumns" :key="column">{{ row[column] ?? '—' }}</td>
            <td>{{ row.处理状态 }}</td>
            <td class="row-actions">
              <button
                v-if="deviceIdByCode[String(row.装置编号)]"
                class="link"
                type="button"
                @click="openDetail(deviceIdByCode[String(row.装置编号)])"
              >
                查看装置
              </button>
              <button class="link" type="button" @click="repeatReplace(String(row.装置编号))">再次提交</button>
            </td>
          </tr>
          <tr v-if="!replacementRows.length">
            <td :colspan="replacementColumns.length + 2" class="empty-state">暂无更换申请</td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer class="page-foot">
      <span v-if="activeTab === 'shards'">共 {{ result.total }} 台命中 · {{ result.shards.length }} 个间隔分片</span>
      <span v-else-if="activeTab === 'pending'">共 {{ pendingRows.length }} 台待校验</span>
      <span v-else>共 {{ replacementRows.length }} 条更换申请</span>
      <span v-if="message" :class="messageOk ? 'ok-text' : 'error-text'">{{ message }}</span>
    </footer>

    <!-- 装置详情抽屉：列表与这里的上次校验日同源 -->
    <div v-if="detail" class="drawer-mask" @click.self="closeDetail">
      <aside class="drawer">
        <header class="drawer-head">
          <h3>{{ String(detail.device.装置编号) }} · 装置详情</h3>
          <button class="btn ghost" type="button" @click="closeDetail">关闭</button>
        </header>
        <dl class="detail-grid">
          <div v-for="field in detailFields" :key="field" class="detail-cell">
            <dt>{{ field }}</dt>
            <dd>
              {{ detail.device[field] ?? '—' }}
              <em v-if="field === '上次校验日'" class="source-hint">{{ detail.device.上次校验日来源 }}</em>
            </dd>
          </div>
        </dl>
        <p class="detail-note">上次校验日与台账列表同一份；台账与校验记录冲突时，以最近一次校验记录为准。</p>

        <h4>校验记录（{{ detail.relays.length }}）</h4>
        <table class="data-table mini-table">
          <thead>
            <tr>
              <th>校验编号</th>
              <th>保护类型</th>
              <th>校验项目</th>
              <th>校验日期</th>
              <th>校验人</th>
              <th>结论</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in detail.relays" :key="String(record.id)">
              <td>{{ record.校验编号 }}</td>
              <td>{{ record.保护类型 }}</td>
              <td>{{ record.校验项目 }}</td>
              <td>{{ record.校验日期 }}</td>
              <td>{{ record.校验人 }}</td>
              <td>{{ record.status }}</td>
            </tr>
            <tr v-if="!detail.relays.length">
              <td colspan="6" class="empty-state">暂无校验记录</td>
            </tr>
          </tbody>
        </table>

        <h4>更换申请（{{ detail.replacements.length }}）</h4>
        <table v-if="detail.replacements.length" class="data-table mini-table">
          <thead>
            <tr>
              <th>申请单号</th>
              <th>申请日期</th>
              <th>申请人</th>
              <th>原因</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in detail.replacements" :key="String(record.id)">
              <td>{{ record.申请单号 }}</td>
              <td>{{ record.申请日期 }}</td>
              <td>{{ record.申请人 }}</td>
              <td>{{ record.申请原因 }}</td>
              <td>{{ record.处理状态 }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted-line">该装置尚无更换申请。</p>

        <div class="drawer-actions">
          <button class="btn" type="button" @click="openCycle(Number(detail.device.id))">核定校验周期</button>
          <button
            class="btn"
            type="button"
            :disabled="detail.device.status === '需更换'"
            @click="openComplete(Number(detail.device.id))"
          >
            完成校验
          </button>
          <button
            class="btn primary"
            type="button"
            :disabled="detail.device.status === '需更换'"
            @click="openReplace(Number(detail.device.id))"
          >
            提出更换
          </button>
        </div>
      </aside>
    </div>

    <!-- 登记保护装置 -->
    <div v-if="createOpen" class="drawer-mask" @click.self="createOpen = false">
      <aside class="drawer narrow">
        <header class="drawer-head">
          <h3>登记保护装置</h3>
          <button class="btn ghost" type="button" @click="createOpen = false">关闭</button>
        </header>
        <form class="modal-form" @submit.prevent="submitCreate">
          <label><span>装置编号 *</span><input v-model="createForm.装置编号" placeholder="PROT-0311" /></label>
          <label><span>所属间隔 *</span><input v-model="createForm.所属间隔" list="bay-list" placeholder="选择或填写所属间隔" /></label>
          <label><span>装置型号 *</span><input v-model="createForm.装置型号" list="model-list" /></label>
          <label>
            <span>保护类型 *</span>
            <select v-model="createForm.保护类型">
              <option value="">请选择（沿用既有保护类型口径）</option>
              <option v-for="item in typeOptions" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
          <label><span>投运日期</span><input v-model="createForm.投运日期" type="date" /></label>
          <label><span>校验周期（由专责后续核定）</span><input v-model="createForm.校验周期" placeholder="如 3年 / 6年" /></label>
          <label><span>装置专责</span><input v-model="createForm.装置专责" /></label>
          <p class="form-tip">新登记装置默认进入「待校验」，按所属间隔分片维护。</p>
          <div class="drawer-actions">
            <button class="btn primary" type="submit">提交登记</button>
          </div>
        </form>
      </aside>
    </div>

    <!-- 核定校验周期 -->
    <div v-if="cycleOpen" class="drawer-mask" @click.self="cycleOpen = false">
      <aside class="dialog">
        <h3>核定校验周期</h3>
        <form class="modal-form" @submit.prevent="submitCycle">
          <label><span>校验周期</span><input v-model="cycleForm.cycle" placeholder="如 6年" /></label>
          <label><span>装置专责核定人</span><input v-model="cycleForm.approver" /></label>
          <div class="drawer-actions">
            <button class="btn primary" type="submit">确认核定</button>
            <button class="btn ghost" type="button" @click="cycleOpen = false">取消</button>
          </div>
        </form>
      </aside>
    </div>

    <!-- 完成校验 -->
    <div v-if="completeOpen" class="drawer-mask" @click.self="completeOpen = false">
      <aside class="dialog">
        <h3>完成校验</h3>
        <form class="modal-form" @submit.prevent="submitComplete">
          <label><span>本次校验日期</span><input v-model="completeForm.date" type="date" /></label>
          <div class="drawer-actions">
            <button class="btn primary" type="submit">确认完成</button>
            <button class="btn ghost" type="button" @click="completeOpen = false">取消</button>
          </div>
        </form>
      </aside>
    </div>

    <!-- 提出更换 -->
    <div v-if="replaceOpen" class="drawer-mask" @click.self="replaceOpen = false">
      <aside class="dialog">
        <h3>提出更换申请</h3>
        <form class="modal-form" @submit.prevent="submitReplace">
          <label><span>申请原因</span><textarea v-model="replaceForm.reason" rows="3" /></label>
          <p class="form-tip">同一台装置重复提交只落一条；提交后装置转「需更换」，不再进入待校验清单。</p>
          <div class="drawer-actions">
            <button class="btn primary" type="submit">提交申请</button>
            <button class="btn ghost" type="button" @click="replaceOpen = false">取消</button>
          </div>
        </form>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import { downloadEntries } from '@/api/local-service'
import {
  EMPTY_FILTER,
  allDeviceViews,
  approveCycle,
  completeCheck,
  deviceDetail,
  deviceStats,
  listPendingDevices,
  listReplacements,
  modelOptions,
  protectionTypeOptions,
  queryDevices,
  registerDevice,
  requestReplacement,
} from '@/api/protection-service'
import { useFilterStore } from '@/stores/filters'
import type { DeviceDetail, DeviceFilter, DeviceView, EntryRow } from '@/data/types'

const FILTER_KEY = 'protectiondevice'
const filterStore = useFilterStore()

const shardColumns = ['装置编号', '装置型号', '保护类型', '投运日期', '校验周期', '装置专责', '上次校验日']
const pendingColumns = ['装置编号', '所属间隔', '装置型号', '保护类型', '校验周期', '装置专责', '上次校验日']
const replacementColumns = ['申请单号', '装置编号', '所属间隔', '装置型号', '申请原因', '申请人', '申请日期']
const detailFields = [
  '装置编号', '所属间隔', '装置型号', '保护类型', '投运日期', '校验周期', '装置专责', '上次校验日',
]

const activeTab = ref<'shards' | 'pending' | 'replacements'>('shards')
const message = ref('')
const messageOk = ref(false)

const savedFilter = filterStore.get(FILTER_KEY) as Partial<DeviceFilter>
const filter = reactive<DeviceFilter>({ ...EMPTY_FILTER, ...savedFilter })

const result = ref<ReturnType<typeof queryDevices>>({ items: [], total: 0, shards: [], mismatch: [] })
const pendingRows = ref<DeviceView[]>([])
const replacementRows = ref<EntryRow[]>([])
const stats = ref(deviceStats())
const typeOptions = ref<string[]>(protectionTypeOptions())
const modelOptionList = ref<string[]>(modelOptions())

const collapsedShards = ref<Set<string>>(new Set())
const collapsedAll = ref(false)

const detail = ref<DeviceDetail | null>(null)
const createOpen = ref(false)
const createForm = reactive({
  装置编号: '',
  所属间隔: '',
  装置型号: '',
  保护类型: '',
  投运日期: '',
  校验周期: '',
  装置专责: '',
})

const cycleOpen = ref(false)
const cycleTarget = ref<number | null>(null)
const cycleForm = reactive({ cycle: '', approver: '' })
const completeOpen = ref(false)
const completeTarget = ref<number | null>(null)
const completeForm = reactive({ date: new Date().toISOString().slice(0, 10) })
const replaceOpen = ref(false)
const replaceTarget = ref<number | null>(null)
const replaceForm = reactive({ reason: '' })

const hasCondition = computed(() =>
  Object.values(filter).some((value) => value.trim() !== ''),
)

const activeChips = computed(() => {
  const chips: string[] = []
  if (filter.装置编号.trim()) chips.push(`编号含「${filter.装置编号.trim()}」`)
  if (filter.所属间隔.trim()) chips.push(`间隔含「${filter.所属间隔.trim()}」`)
  if (filter.装置型号.trim()) chips.push(`型号含「${filter.装置型号.trim()}」`)
  if (filter.保护类型.trim()) chips.push(`保护类型=${filter.保护类型}`)
  if (filter.校验日起.trim() || filter.校验日止.trim()) {
    chips.push(`上次校验日 ${filter.校验日起.trim() || '不限'}~${filter.校验日止.trim() || '不限'}`)
  }
  return chips
})

const bayOptions = computed(() => [
  ...new Set(allDeviceViews().map((row) => String(row.所属间隔))),
].sort((a, b) => a.localeCompare(b, 'zh')))

const deviceIdByCode = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {}
  for (const row of allDeviceViews()) map[String(row.装置编号)] = Number(row.id)
  return map
})

const tabs = computed(() => [
  { key: 'shards' as const, label: '间隔分片台账', count: null },
  { key: 'pending' as const, label: '待校验清单', count: pendingRows.value.length },
  { key: 'replacements' as const, label: '更换申请', count: replacementRows.value.length },
])

function flash(text: string, ok = false) {
  message.value = text
  messageOk.value = ok
}

function reload(keepFilter = true) {
  result.value = queryDevices(filter)
  pendingRows.value = listPendingDevices()
  replacementRows.value = listReplacements()
  stats.value = deviceStats()
  typeOptions.value = protectionTypeOptions()
  modelOptionList.value = modelOptions()
  if (keepFilter) {
    filterStore.set(FILTER_KEY, { ...filter })
  }
}

function applyFilter() {
  reload()
  flash(`已按 ${activeChips.value.length} 个叠加条件查询，命中 ${result.value.total} 台`, true)
}

function resetFilter() {
  Object.assign(filter, EMPTY_FILTER)
  filterStore.clear(FILTER_KEY)
  collapsedShards.value = new Set()
  reload(false)
  flash('筛选条件已重置', true)
}

function toggleShard(bay: string) {
  const nextSet = new Set(collapsedShards.value)
  if (nextSet.has(bay)) nextSet.delete(bay)
  else nextSet.add(bay)
  collapsedShards.value = nextSet
}

function toggleAllShards() {
  if (collapsedAll.value) {
    collapsedShards.value = new Set()
    collapsedAll.value = false
  } else {
    collapsedShards.value = new Set(result.value.shards.map((shard) => shard.bay))
    collapsedAll.value = true
  }
}

function exportRows() {
  downloadEntries(FILTER_KEY)
}

function openCreate() {
  Object.assign(createForm, {
    装置编号: '', 所属间隔: '', 装置型号: '', 保护类型: '',
    投运日期: '', 校验周期: '', 装置专责: '',
  })
  createOpen.value = true
}

function submitCreate() {
  const out = registerDevice({ ...createForm })
  if (!out.ok) {
    flash(out.message)
    return
  }
  createOpen.value = false
  reload()
  flash(out.message, true)
}

function openDetail(id: number) {
  detail.value = deviceDetail(id) ?? null
}

function closeDetail() {
  detail.value = null
}

function openCycle(id: number) {
  const item = deviceDetail(id)
  cycleTarget.value = id
  cycleForm.cycle = item ? String(item.device.校验周期 ?? '') : ''
  cycleForm.approver = item ? String(item.device.装置专责 ?? '') : ''
  cycleOpen.value = true
}

function submitCycle() {
  if (cycleTarget.value === null) return
  const out = approveCycle(cycleTarget.value, cycleForm.cycle, cycleForm.approver)
  if (!out.ok) {
    flash(out.message)
    return
  }
  cycleOpen.value = false
  reload()
  if (detail.value) detail.value = deviceDetail(Number(detail.value.device.id)) ?? detail.value
  flash(out.message, true)
}

function openComplete(id: number) {
  completeTarget.value = id
  completeForm.date = new Date().toISOString().slice(0, 10)
  completeOpen.value = true
}

function submitComplete() {
  if (completeTarget.value === null) return
  const out = completeCheck(completeTarget.value, completeForm.date)
  if (!out.ok) {
    flash(out.message)
    return
  }
  completeOpen.value = false
  reload()
  if (detail.value) detail.value = deviceDetail(Number(detail.value.device.id)) ?? detail.value
  flash(out.message, true)
}

function openReplace(id: number) {
  replaceTarget.value = id
  replaceForm.reason = ''
  replaceOpen.value = true
}

function submitReplace() {
  if (replaceTarget.value === null) return
  const out = requestReplacement(replaceTarget.value, replaceForm.reason)
  if (!out.ok) {
    flash(out.message)
    return
  }
  replaceOpen.value = false
  reload()
  if (detail.value) detail.value = deviceDetail(Number(detail.value.device.id)) ?? detail.value
  flash(out.message, true)
}

function repeatReplace(code: string) {
  const id = deviceIdByCode.value[code]
  if (!id) {
    flash('没有找到对应装置')
    return
  }
  const out = requestReplacement(id, '重复提交')
  flash(out.message, out.ok)
  reload()
}

reload()
</script>
