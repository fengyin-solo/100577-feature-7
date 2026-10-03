<template>
  <section class="page" data-module="protectiondevice">
    <header class="page-head">
      <div>
        <h2>保护装置台账管理</h2>
        <p class="page-desc">
          保护装置按所属间隔分片维护，校验周期由装置专责核定；装置编号、装置型号、保护类型可叠加取交集，
          上次校验日按起止区间定位。
        </p>
      </div>
      <div class="page-actions">
        <button class="btn" type="button" @click="exportRows">导出保护装置台账清单</button>
      </div>
    </header>

    <div class="stat-row">
      <article v-for="item in stats" :key="item.label" class="stat-card">
        <span class="stat-label">{{ item.label }}</span>
        <strong class="stat-value">{{ item.value }}</strong>
      </article>
    </div>

    <div class="tab-row" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: ui.tab === tab.key }"
        type="button"
        role="tab"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
        <span v-if="tab.count !== null" class="tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <!-- 分片 + 定位条件：条件持久化，翻页/切走/刷新都不丢 -->
    <template v-if="ui.tab === 'devices'">
      <div class="shard-bar">
        <span class="shard-label">电压等级分片</span>
        <button
          class="shard-chip"
          :class="{ active: ui.group === '' }"
          type="button"
          @click="selectGroup('')"
        >
          全部分片
        </button>
        <button
          v-for="group in pageData.groupCounts"
          :key="group.group"
          class="shard-chip"
          :class="{ active: ui.group === group.group }"
          type="button"
          @click="selectGroup(group.group)"
        >
          {{ group.group }}
          <span class="chip-count">{{ group.count }}</span>
          <span v-if="group.overdue" class="chip-warn">待校验 {{ group.overdue }}</span>
        </button>
      </div>

      <form class="filter-bar" @submit.prevent="reload(1)">
        <label class="filter-item">
          <span>所属间隔</span>
          <select v-model="ui.filters.bay" @change="reload(1)">
            <option value="">全部分片间隔</option>
            <optgroup v-for="group in filteredBayGroups" :key="group.group" :label="group.group">
              <option v-for="bay in group.bays" :key="bay.bay" :value="bay.bay">
                {{ bay.bay }}（{{ bay.count }} 台{{ bay.overdue ? `，待校验 ${bay.overdue}` : '' }}）
              </option>
            </optgroup>
          </select>
        </label>
        <label class="filter-item">
          <span>装置编号</span>
          <input v-model="ui.filters.deviceNo" placeholder="如 PROT-0128" />
        </label>
        <label class="filter-item">
          <span>装置型号</span>
          <select v-model="ui.filters.model" @change="reload(1)">
            <option value="">全部型号</option>
            <optgroup v-for="group in modelOptions" :key="group.type" :label="group.type">
              <option v-for="model in group.models" :key="model" :value="model">{{ model }}</option>
            </optgroup>
          </select>
        </label>
        <label class="filter-item">
          <span>保护类型</span>
          <select v-model="ui.filters.protectionType" @change="reload(1)">
            <option value="">全部保护类型</option>
            <option v-for="type in PROTECTION_TYPES" :key="type" :value="type">{{ type }}</option>
          </select>
        </label>
        <label class="filter-item">
          <span>上次校验日（起）</span>
          <input v-model="ui.filters.checkFrom" type="date" />
        </label>
        <label class="filter-item">
          <span>上次校验日（止）</span>
          <input v-model="ui.filters.checkTo" type="date" />
        </label>
        <button class="btn primary" type="submit">查询定位</button>
        <button class="btn ghost" type="button" @click="resetFilters">重置条件</button>
      </form>

      <!-- 一条没命中：逐格写明是哪一格没对上 -->
      <div v-if="pageData.total === 0 && hasAnyFilter" class="no-hit">
        <p class="no-hit-title">没有任何装置命中当前条件，逐格核对如下：</p>
        <table class="data-table">
          <thead>
            <tr><th>筛选格</th><th>填写值</th><th>单独命中</th><th>结论</th></tr>
          </thead>
          <tbody>
            <tr v-for="cell in activeCells" :key="cell.key" :class="{ 'row-bad': cell.active && cell.hits === 0 }">
              <td>{{ cell.label }}</td>
              <td>{{ cell.value || '—' }}</td>
              <td>{{ cell.hits }} 台</td>
              <td>
                <span v-if="cell.hits === 0" class="error-text">✗ 这一格对不上，没有装置满足</span>
                <span v-else class="ok-text">✓ 本格有 {{ cell.hits }} 台，被其他条件交集掉了</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="muted-note">提示：先只留一个条件查询，逐格放宽即可定位到目标装置。</p>
      </div>

      <table v-else class="data-table">
        <thead>
          <tr>
            <th v-for="column in columns" :key="column">{{ column }}</th>
            <th>下次校验日</th>
            <th>当前状态</th>
            <th>可执行动作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in pageData.items" :key="String(row.id)">
            <td v-for="column in columns" :key="column">
              <button v-if="column === '装置编号'" class="link" type="button" @click="openDetail(row)">
                {{ row[column] }}
              </button>
              <template v-else>{{ row[column] || '—' }}</template>
            </td>
            <td>
              {{ scheduleOf(row).nextCheck || '—' }}
              <span v-if="scheduleOf(row).daysOverdue > 0" class="error-text">
                超{{ scheduleOf(row).daysOverdue }}天
              </span>
            </td>
            <td><span class="status-tag" :class="statusClass(row.status)">{{ row.status }}</span></td>
            <td class="row-actions">
              <button
                v-if="row.status !== '需更换'"
                class="link"
                type="button"
                @click="openCheck(row)"
              >
                登记校验结果
              </button>
              <button class="link" type="button" @click="openCycle(row)">核定校验周期</button>
              <button
                v-if="row.status !== '需更换'"
                class="link"
                type="button"
                @click="openReplace(row)"
              >
                提出更换
              </button>
              <span v-else class="muted-note">需更换，不再校验</span>
            </td>
          </tr>
        </tbody>
      </table>

      <footer class="page-foot">
        <span>当前条件共 {{ pageData.total }} 台，第 {{ pageData.page }} / {{ totalPages }} 页</span>
        <span class="pager">
          <button class="btn" type="button" :disabled="pageData.page <= 1" @click="reload(pageData.page - 1)">上一页</button>
          <button
            class="btn"
            type="button"
            :disabled="pageData.page >= totalPages"
            @click="reload(pageData.page + 1)"
          >
            下一页
          </button>
        </span>
      </footer>
    </template>

    <!-- 待校验清单：需更换装置不进 -->
    <template v-else-if="ui.tab === 'pending'">
      <p class="status-legend">
        <span class="legend-item">下次校验日早于今天即列入；进入「需更换」的装置不再进此清单</span>
      </p>
      <table class="data-table">
        <thead>
          <tr>
            <th>装置编号</th><th>所属间隔</th><th>装置型号</th><th>保护类型</th>
            <th>校验周期</th><th>上次校验日</th><th>下次校验日</th><th>超期天数</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in pendingRows" :key="String(item.row.id)">
            <td>
              <button class="link" type="button" @click="openDetail(item.row)">{{ item.row['装置编号'] }}</button>
            </td>
            <td>{{ item.row['所属间隔'] }}</td>
            <td>{{ item.row['装置型号'] }}</td>
            <td>{{ item.row['保护类型'] }}</td>
            <td>{{ item.row['校验周期'] }}</td>
            <td>{{ item.row['上次校验日'] || '未校验（首检）' }}</td>
            <td>{{ item.nextCheck }}</td>
            <td><strong class="error-text">{{ item.daysOverdue }} 天</strong></td>
            <td><button class="link" type="button" @click="openCheck(item.row)">登记校验结果</button></td>
          </tr>
          <tr v-if="!pendingRows.length">
            <td colspan="9" class="empty-state">当前没有待校验装置</td>
          </tr>
        </tbody>
      </table>
      <footer class="page-foot"><span>共 {{ pendingRows.length }} 台待校验</span></footer>
    </template>

    <!-- 更换申请：同一台装置重复提交只落一条 -->
    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>申请编号</th><th>装置编号</th><th>所属变电站</th><th>更换原因</th>
            <th>申请人</th><th>申请日期</th><th>状态</th><th>处理备注</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in replacementRows" :key="String(item.id)">
            <td>{{ item['申请编号'] }}</td>
            <td>{{ item['装置编号'] }}</td>
            <td>{{ item['所属变电站'] }}</td>
            <td>{{ item['更换原因'] }}</td>
            <td>{{ item['申请人'] }}</td>
            <td>{{ item['申请日期'] }}</td>
            <td><span class="status-tag" :class="item.status === '申请中' ? 'tag-warn' : 'tag-done'">{{ item.status }}</span></td>
            <td>{{ item['处理备注'] || '—' }}</td>
            <td>
              <button v-if="item.status === '申请中'" class="link" type="button" @click="closeRequest(item)">
                闭环（已换新）
              </button>
              <span v-else class="muted-note">已闭环</span>
            </td>
          </tr>
          <tr v-if="!replacementRows.length">
            <td colspan="9" class="empty-state">暂无更换申请</td>
          </tr>
        </tbody>
      </table>
      <footer class="page-foot"><span>共 {{ replacementRows.length }} 条更换申请</span></footer>
    </template>

    <p v-if="message" class="result-line" :class="messageOk ? 'ok-text' : 'error-text'">{{ message }}</p>

    <DeviceDrawer
      :detail="detail"
      @close="detail = null"
      @check="onDrawerCheck"
      @cycle="onDrawerCycle"
      @replace="onDrawerReplace"
    />

    <!-- 登记校验结果 -->
    <div v-if="checkModal.row" class="modal-mask" @click.self="checkModal.row = null">
      <form class="modal" @submit.prevent="submitCheck">
        <h3>登记校验结果 · {{ checkModal.row['装置编号'] }}</h3>
        <p class="muted-note">保存后自动写入一条保护校验记录；上次校验日以最近一次校验记录为准。</p>
        <label class="modal-field">
          <span>校验日期</span>
          <input v-model="checkModal.date" type="date" required />
        </label>
        <label class="modal-field">
          <span>校验项目</span>
          <input v-model="checkModal.item" placeholder="全检 / 部检 / 首检 / 例行校验" />
        </label>
        <label class="modal-field">
          <span>校验人</span>
          <input v-model="checkModal.verifier" placeholder="校验人姓名" required />
        </label>
        <div class="modal-field">
          <span>校验判定</span>
          <label class="inline-check"><input v-model="checkModal.passed" type="radio" :value="true" />合格</label>
          <label class="inline-check"><input v-model="checkModal.passed" type="radio" :value="false" />不合格</label>
        </div>
        <p v-if="checkModal.passed" class="muted-note">判定合格后，结论会同步到定值整定的待整定清单（同装置不重复落单）。</p>
        <div class="modal-actions">
          <button class="btn primary" type="submit">保存</button>
          <button class="btn ghost" type="button" @click="checkModal.row = null">取消</button>
        </div>
      </form>
    </div>

    <!-- 核定校验周期 -->
    <div v-if="cycleModal.row" class="modal-mask" @click.self="cycleModal.row = null">
      <form class="modal" @submit.prevent="submitCycle">
        <h3>核定校验周期 · {{ cycleModal.row['装置编号'] }}</h3>
        <label class="modal-field">
          <span>校验周期（由装置专责核定）</span>
          <select v-model="cycleModal.cycle" required>
            <option value="1年">1年（新投/首检）</option>
            <option value="3年">3年</option>
            <option value="6年">6年</option>
          </select>
        </label>
        <label class="modal-field">
          <span>核定人</span>
          <input v-model="cycleModal.approver" placeholder="装置专责姓名" required />
        </label>
        <div class="modal-actions">
          <button class="btn primary" type="submit">保存核定</button>
          <button class="btn ghost" type="button" @click="cycleModal.row = null">取消</button>
        </div>
      </form>
    </div>

    <!-- 提出更换 -->
    <div v-if="replaceModal.row" class="modal-mask" @click.self="replaceModal.row = null">
      <form class="modal" @submit.prevent="submitReplace">
        <h3>提出更换 · {{ replaceModal.row['装置编号'] }}</h3>
        <p class="muted-note">同一台装置已有申请中的更换申请时，重复提交不再落单；提交后装置进入「需更换」，不再进待校验清单。</p>
        <label class="modal-field">
          <span>更换原因</span>
          <textarea v-model="replaceModal.reason" rows="3" required></textarea>
        </label>
        <label class="modal-field">
          <span>申请人</span>
          <input v-model="replaceModal.applicant" required />
        </label>
        <div class="modal-actions">
          <button class="btn primary" type="submit">提交申请</button>
          <button class="btn ghost" type="button" @click="replaceModal.row = null">取消</button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import {
  approveCheckCycle,
  closeReplacementRequest,
  completeDeviceCheck,
  deviceSchedule,
  downloadEntries,
  EMPTY_DEVICE_FILTERS,
  getDeviceDetail,
  listPendingDevices,
  listProtectionDevices,
  listReplacementRequests,
  moduleMeta,
  submitReplacementRequest,
} from '@/api/local-service'
import { usePersistentState } from '@/composables/usePersistentState'
import { BAY_GROUPS, DEVICE_MODELS, PROTECTION_TYPES } from '@/data/domain'
import type {
  DeviceDetail,
  DeviceFilters,
  DevicePageResult,
  EntryRow,
  PendingDevice,
} from '@/data/types'
import { todayISO } from '@/utils/date'
import DeviceDrawer from './DeviceDrawer.vue'

const meta = moduleMeta('protectiondevice')
const columns = [
  '装置编号',
  '所属间隔',
  '装置型号',
  '保护类型',
  '装置位号',
  '校验周期',
  '周期核定人',
  '上次校验日',
]

type UiState = {
  tab: 'devices' | 'pending' | 'replacements'
  group: string
  page: number
  size: number
  filters: DeviceFilters
}

const ui = usePersistentState<UiState>('protectiondevice', () => ({
  tab: 'devices',
  group: '',
  page: 1,
  size: 20,
  filters: { ...EMPTY_DEVICE_FILTERS },
}))

const pageData = ref<DevicePageResult>({
  items: [],
  total: 0,
  page: 1,
  size: ui.size,
  cells: [],
  bayGroups: [],
  groupCounts: [],
})
const pendingRows = ref<PendingDevice[]>([])
const replacementRows = ref<EntryRow[]>([])
const detail = ref<DeviceDetail | null>(null)
const message = ref('')
const messageOk = ref(false)

const checkModal = reactive<{
  row: EntryRow | null
  date: string
  item: string
  verifier: string
  passed: boolean
}>({ row: null, date: todayISO(), item: '例行校验', verifier: '', passed: true })

const cycleModal = reactive<{ row: EntryRow | null; cycle: string; approver: string }>({
  row: null,
  cycle: '3年',
  approver: '',
})

const replaceModal = reactive<{ row: EntryRow | null; reason: string; applicant: string }>({
  row: null,
  reason: '',
  applicant: '值班管理员',
})

const modelOptions = Object.entries(DEVICE_MODELS).map(([type, models]) => ({ type, models }))

const totalPages = computed(() => Math.max(1, Math.ceil(pageData.value.total / pageData.value.size)))
const hasAnyFilter = computed(() => pageData.value.cells.some((cell) => cell.key !== 'combined' && cell.active))
const activeCells = computed(() => pageData.value.cells.filter((cell) => cell.key !== 'combined'))

const filteredBayGroups = computed(() =>
  ui.group ? pageData.value.bayGroups.filter((item) => item.group === ui.group) : pageData.value.bayGroups,
)

const stats = computed(() => {
  const counts = pageData.value.groupCounts.reduce(
    (acc, item) => ({ count: acc.count + item.count, overdue: acc.overdue + item.overdue }),
    { count: 0, overdue: 0 },
  )
  const replacementOpen = replacementRows.value.filter((row) => row.status === '申请中').length
  return [
    { label: '台账装置总数', value: counts.count },
    { label: '待校验装置', value: counts.overdue },
    { label: '需更换装置', value: replacementOpen },
  ]
})

const tabs = computed(() => [
  { key: 'devices' as const, label: '装置台账', count: null },
  { key: 'pending' as const, label: '待校验清单', count: pendingRows.value.length },
  { key: 'replacements' as const, label: '更换申请', count: replacementRows.value.filter((r) => r.status === '申请中').length },
])

function flash(text: string, ok = true) {
  message.value = text
  messageOk.value = ok
}

function scheduleOf(row: EntryRow) {
  return deviceSchedule(row)
}

function statusClass(status: string | number | boolean): string {
  return (
    {
      待校验: 'tag-warn',
      运行正常: 'tag-ok',
      已校验: 'tag-done',
      需更换: 'tag-bad',
    }[String(status)] ?? ''
  )
}

function reload(page?: number) {
  message.value = ''
  messageOk.value = false
  const { checkFrom, checkTo } = ui.filters
  if (checkFrom && checkTo && checkFrom > checkTo) {
    pageData.value = {
      items: [], total: 0, page: 1, size: ui.size, cells: [], bayGroups: pageData.value.bayGroups,
      groupCounts: pageData.value.groupCounts,
    }
    message.value = `上次校验日区间不合法：起 ${checkFrom} 晚于止 ${checkTo}`
    return
  }
  if (page !== undefined) {
    ui.page = page
  }
  // 选了电压等级分片却停留在别的间隔，自动收回到该分片
  if (ui.group && ui.filters.bay && !bayBelongsToGroup(ui.filters.bay, ui.group)) {
    ui.filters.bay = ''
  }
  const payload = listProtectionDevices(ui.filters, ui.page, ui.size)
  pageData.value = payload
  ui.page = payload.page
  refreshAuxiliary()
}

function refreshAuxiliary() {
  pendingRows.value = listPendingDevices()
  replacementRows.value = listReplacementRequests()
}

function bayBelongsToGroup(bay: string, group: string): boolean {
  return BAY_GROUPS.find((item) => item.group === group)?.bays.includes(bay) ?? false
}

function selectGroup(group: string) {
  ui.group = group
  ui.filters.bay = ''
  reload(1)
}

function switchTab(tab: UiState['tab']) {
  ui.tab = tab
  if (tab === 'pending' || tab === 'replacements') {
    refreshAuxiliary()
  } else {
    reload()
  }
}

function resetFilters() {
  ui.filters = { ...EMPTY_DEVICE_FILTERS }
  ui.group = ''
  reload(1)
}

function exportRows() {
  downloadEntries(meta.key)
}

function openDetail(row: EntryRow) {
  detail.value = getDeviceDetail(Number(row.id))
}

function refreshDetail() {
  if (detail.value) {
    detail.value = getDeviceDetail(Number(detail.value.device.id))
  }
}

function openCheck(row: EntryRow) {
  checkModal.row = row
  checkModal.date = String(row['上次校验日'] ?? '') || todayISO()
  checkModal.item = '例行校验'
  checkModal.verifier = ''
  checkModal.passed = true
}

function onDrawerCheck(row: EntryRow) {
  detail.value = null
  openCheck(row)
}

function submitCheck() {
  if (!checkModal.row) {
    return
  }
  const result = completeDeviceCheck(Number(checkModal.row.id), {
    date: checkModal.date,
    verifier: checkModal.verifier,
    item: checkModal.item,
    passed: checkModal.passed,
  })
  flash(result.message, result.ok)
  if (result.ok) {
    checkModal.row = null
    reload()
  }
}

function openCycle(row: EntryRow) {
  cycleModal.row = row
  cycleModal.cycle = String(row['校验周期'] ?? '3年')
  cycleModal.approver = String(row['周期核定人'] ?? '')
}

function onDrawerCycle(row: EntryRow) {
  detail.value = null
  openCycle(row)
}

function submitCycle() {
  if (!cycleModal.row) {
    return
  }
  const result = approveCheckCycle(Number(cycleModal.row.id), cycleModal.cycle, cycleModal.approver)
  flash(result.message, result.ok)
  if (result.ok) {
    cycleModal.row = null
    refreshDetail()
    reload()
  }
}

function openReplace(row: EntryRow) {
  replaceModal.row = row
  replaceModal.reason = ''
  replaceModal.applicant = '值班管理员'
}

function onDrawerReplace(row: EntryRow) {
  detail.value = null
  openReplace(row)
}

function submitReplace() {
  if (!replaceModal.row) {
    return
  }
  const result = submitReplacementRequest(
    Number(replaceModal.row.id),
    replaceModal.reason,
    replaceModal.applicant,
  )
  flash(result.message, result.ok)
  if (result.ok) {
    replaceModal.row = null
    reload()
  }
}

function closeRequest(row: EntryRow) {
  const result = closeReplacementRequest(Number(row.id), '')
  flash(result.message, result.ok)
  if (result.ok) {
    refreshAuxiliary()
    refreshDetail()
  }
}

onMounted(() => {
  reload()
})
</script>
