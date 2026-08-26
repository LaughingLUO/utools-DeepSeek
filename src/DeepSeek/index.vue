<script setup>
import AccountBindDialog from './components/AccountBindDialog.vue'
import AccountsTable from './components/AccountsTable.vue'
import RenameAccountDialog from './components/RenameAccountDialog.vue'
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
  renameDialogState,
  hasAccounts,
  canSavePending,
  canStartCapture,
  openCreateDialog,
  openRenameDialog,
  closeDialog,
  closeRenameDialog,
  updateDialogName,
  updateRenameDialogName,
  startBindingFlow,
  saveBinding,
  makeDefault,
  saveRename,
  removeAccount
} = useDeepSeekAccounts()
</script>

<template>
  <main class="settings-page">
    <section class="settings-panel">
      <div class="settings-panel__header">
        <h2 class="settings-panel__title">用户列表</h2>

        <div class="settings-panel__actions">
          <button
            class="primary-button"
            @click="openCreateDialog"
          >
            新增绑定账号
          </button>
        </div>
      </div>

      <AccountsTable
        :accounts="accounts"
        :default-account-id="defaultAccountId"
        :has-accounts="hasAccounts"
        @set-default="makeDefault"
        @rename="openRenameDialog"
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

    <RenameAccountDialog
      :open="renameDialogState.open"
      :name="renameDialogState.name"
      @update:name="updateRenameDialogName"
      @close="closeRenameDialog"
      @save="saveRename"
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

.settings-panel__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
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

  .settings-panel__actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
