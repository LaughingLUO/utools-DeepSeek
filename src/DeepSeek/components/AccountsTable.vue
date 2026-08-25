<script setup>
const props = defineProps({
  accounts: {
    type: Array,
    default: () => []
  },
  defaultAccountId: {
    type: String,
    default: ''
  },
  hasAccounts: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'set-default',
  'remove'
])
</script>

<template>
  <div
    v-if="hasAccounts"
    class="accounts-table"
  >
    <table class="accounts-table__table">
      <thead>
        <tr>
          <th>账户名称</th>
          <th>默认账号</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="account in accounts"
          :key="account.id"
        >
          <td>{{ account.name }}</td>
          <td>{{ account.id === defaultAccountId ? '是' : '否' }}</td>
          <td>
            <div class="accounts-table__actions">
              <button
                class="ghost-button"
                :disabled="account.id === defaultAccountId"
                @click="emit('set-default', account.id)"
              >
                设为默认
              </button>
              <button
                class="ghost-button ghost-button--danger"
                @click="emit('remove', account)"
              >
                删除
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div
    v-else
    class="accounts-empty"
  >
    还没有已保存账号，点击上面的“新增绑定账号”开始配置。
  </div>
</template>

<style scoped>
.accounts-table {
  overflow: auto;
  border-radius: 18px;
  border: 1px solid var(--panel-border);
}

.accounts-table__table {
  width: 100%;
  border-collapse: collapse;
  min-width: 640px;
  background: var(--table-bg);
}

.accounts-table__table th,
.accounts-table__table td {
  padding: 16px 14px;
  text-align: left;
  border-bottom: 1px solid var(--table-row-border);
  vertical-align: top;
}

.accounts-table__table th {
  font-size: 13px;
  color: var(--table-head-color);
  background: var(--table-head-bg);
}

.accounts-table__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.accounts-empty {
  padding: 28px;
  border-radius: 18px;
  border: 1px dashed var(--empty-border);
  color: var(--empty-color);
}
</style>
