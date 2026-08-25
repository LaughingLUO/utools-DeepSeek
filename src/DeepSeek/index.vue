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
        <h2 class="settings-panel__title">用户列表</h2>

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

.settings-panel__title {
  margin: 0;
}

.settings-panel {
  padding: 24px;
  border-radius: 26px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  backdrop-filter: blur(14px);
  box-shadow: var(--panel-shadow);
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
