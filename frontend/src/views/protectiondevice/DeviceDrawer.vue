<template>
  <div v-if="detail" class="drawer-mask" @click.self="emit('close')">
    <aside class="drawer" role="dialog" aria-label="保护装置详情">
      <header class="drawer-head">
        <div>
          <h3>{{ detail.device['装置编号'] }} · {{ detail.device['所属间隔'] }}</h3>
          <p class="page-desc">装置详情与台账列表共用同一份「上次校验日」，冲突时以最近一次校验记录为准。</p>
        </div>
        <button class="btn ghost" type="button" @click="emit('close')">关闭</button>
      </header>

      <div class="drawer-body">
        <span class="status-tag" :class="statusClass(detail.device.status)">{{ detail.device.status }}</span>

        <h4 class="drawer-title">台账信息</h4>
        <dl class="detail-grid">
          <template v-for="field in infoFields" :key="field">
            <dt>{{ field }}</dt>
            <dd>{{ detail.device[field] || '—' }}</dd>
          </template>
          <dt>下次校验日</dt>
          <dd>
            {{ detail.nextCheck || '—' }}
            <strong v-if="detail.daysOverdue > 0" class="error-text">（已超期 {{ detail.daysOverdue }} 天）</strong>
          </dd>
        </dl>

        <h4 class="drawer-title">
          保护校验记录
          <span class="muted-note">共 {{ detail.relayTests.length }} 条，按校验日期倒序</span>
        </h4>
        <table v-if="detail.relayTests.length" class="data-table compact">
          <thead>
            <tr>
              <th>校验编号</th><th>校验项目</th><th>校验日期</th><th>校验人</th><th>结论</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(test, index) in detail.relayTests" :key="String(test.id)" :class="{ 'is-latest': index === 0 }">
              <td>{{ test['校验编号'] }}</td>
              <td>{{ test['校验项目'] }}</td>
              <td>
                {{ test['校验日期'] }}
                <em v-if="index === 0" class="latest-mark">最近一次</em>
              </td>
              <td>{{ test['校验人'] }}</td>
              <td :class="test.status === '校验合格' ? 'ok-text' : 'error-text'">{{ test.status }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted-note">暂无校验记录</p>

        <h4 class="drawer-title">定值单</h4>
        <table v-if="detail.settings.length" class="data-table compact">
          <thead>
            <tr><th>定值单号</th><th>定值项目</th><th>整定值</th><th>状态</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in detail.settings" :key="String(item.id)">
              <td>{{ item['定值单号'] }}</td>
              <td>{{ item['定值项目'] }}</td>
              <td>{{ item['整定值'] }}</td>
              <td>{{ item.status }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted-note">暂无关联定值单</p>

        <h4 class="drawer-title">更换申请</h4>
        <table v-if="detail.replacements.length" class="data-table compact">
          <thead>
            <tr><th>申请编号</th><th>申请日期</th><th>更换原因</th><th>状态</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in detail.replacements" :key="String(item.id)">
              <td>{{ item['申请编号'] }}</td>
              <td>{{ item['申请日期'] }}</td>
              <td>{{ item['更换原因'] }}</td>
              <td>{{ item.status }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted-note">暂无更换申请</p>
      </div>

      <footer class="drawer-foot">
        <button
          class="btn"
          type="button"
          :disabled="detail.device.status === '需更换'"
          @click="emit('check', detail.device)"
        >
          登记校验结果
        </button>
        <button class="btn" type="button" @click="emit('cycle', detail.device)">核定校验周期</button>
        <button
          class="btn"
          type="button"
          :disabled="detail.device.status === '需更换' || hasOpenRequest"
          @click="emit('replace', detail.device)"
        >
          提出更换
        </button>
      </footer>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { DeviceDetail, EntryRow } from '@/data/types'

const props = defineProps<{ detail: DeviceDetail | null }>()
const emit = defineEmits<{
  close: []
  check: [row: EntryRow]
  cycle: [row: EntryRow]
  replace: [row: EntryRow]
}>()

const infoFields = [
  '所属变电站',
  '装置型号',
  '保护类型',
  '装置位号',
  '投运日期',
  '校验周期',
  '周期核定人',
  '周期核定日',
  '上次校验日',
]

const hasOpenRequest = computed(() =>
  props.detail?.replacements.some((item) => String(item.status) === '申请中') ?? false,
)

function statusClass(status: string | number | boolean): string {
  return {
    待校验: 'tag-warn',
    运行正常: 'tag-ok',
    已校验: 'tag-done',
    需更换: 'tag-bad',
  }[String(status)] ?? ''
}
</script>
