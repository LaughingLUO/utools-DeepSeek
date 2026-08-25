<script setup>
import AccountBindDialog from './components/AccountBindDialog.vue'
import AccountsTable from './components/AccountsTable.vue'
import { useDeepSeekAccounts } from './composables/useDeepSeekAccounts'

defineProps({
  enterAction: {
    type: Object,
    required: true
  }
})

const {
  accounts,
  defaultAccountId,
  dialogState,
  hasAccounts,
  canSavePending,
  canStartCapture,
  openCreateDialog,
  closeDialog,
  updateDialogName,
  startBindingFlow,
  saveBinding,
  makeDefault,
  removeAccount
} = useDeepSeekAccounts()
</script>

<template>
  <main class="settings-page">
    <section class="settings-panel">
      <div class="settings-panel__header">
        <div>
          <p class="settings-panel__eyebrow">用户列表</p>
          <h2 class="settings-panel__title">已保存账号</h2>
        </div>

        <button
          class="primary-button"
          @click="openCreateDialog"
        >
          新增绑定账号
        </button>
      </div>

      <AccountsTable
        :accounts="accounts"
        :default-account-id="defaultAccountId"
        :has-accounts="hasAccounts"
        @set-default="makeDefault"
        @remove="removeAccount"
      />
    </section>

    <AccountBindDialog
      :open="dialogState.open"
      :mode="dialogState.mode"
      :name="dialogState.name"
      :is-capturing="dialogState.isCapturing"
      :status-text="dialogState.statusText"
      :session-data="dialogState.capturedSession"
      :can-start-capture="canStartCapture"
      :can-save="canSavePending"
      @update:name="updateDialogName"
      @close="closeDialog"
      @start-login="startBindingFlow"
      @save="saveBinding"
    />
  </main>
</template>

<style scoped>
.settings-page {
  display: grid;
  padding: 24px;
}

.settings-panel {
  display: grid;
  gap: 12px;
}

.settings-panel__eyebrow {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7dd3fc;
}

.settings-panel__title {
  margin: 0;
}

.settings-panel {
  padding: 24px;
  border-radius: 26px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(14px);
}

.settings-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.settings-panel__title {
  font-size: 24px;
}

@media (max-width: 760px) {
  .settings-page {
    padding: 16px;
  }

  .settings-panel__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
