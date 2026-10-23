<script setup>
import { reactive } from 'vue'
import AccountBindDialog from './components/AccountBindDialog.vue'
import AccountsTable from './components/AccountsTable.vue'
import RenameAccountDialog from './components/RenameAccountDialog.vue'
import { useDeepSeekAccounts } from './composables/useDeepSeekAccounts'
import { getPluginSettings, updatePluginSettings } from './services/settingsStore'

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

const settings = reactive(getPluginSettings())

function updateRememberChatWindowBounds(event) {
  settings.rememberChatWindowBounds = event.target.checked
  updatePluginSettings({
    rememberChatWindowBounds: settings.rememberChatWindowBounds
  })
}
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

    <section class="settings-panel settings-panel--preferences">
      <div class="settings-panel__header">
        <div>
          <h2 class="settings-panel__title">通用设置</h2>
          <p class="settings-panel__description">控制 DeepSeek 聊天窗口的启动行为。</p>
        </div>
      </div>

      <label class="settings-toggle">
        <span class="settings-toggle__content">
          <span class="settings-toggle__title">记住聊天窗口位置和大小</span>
          <span class="settings-toggle__description">下次打开聊天窗口时恢复上次关闭前的位置和尺寸。</span>
        </span>
        <input
          type="checkbox"
          :checked="settings.rememberChatWindowBounds"
          @change="updateRememberChatWindowBounds"
        >
        <span class="settings-toggle__track" aria-hidden="true">
          <span class="settings-toggle__thumb" />
        </span>
      </label>
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

.settings-panel--preferences {
  gap: 16px;
}

.settings-panel__description,
.settings-toggle__description {
  margin: 6px 0 0;
  color: var(--muted-text);
  font-size: 13px;
}

.settings-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 18px;
  border: 1px solid var(--panel-border);
  border-radius: 16px;
  background: var(--panel-bg-soft, rgba(255, 255, 255, 0.04));
  cursor: pointer;
}

.settings-toggle__content {
  min-width: 0;
}

.settings-toggle__title {
  display: block;
  font-weight: 600;
}

.settings-toggle input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.settings-toggle__track {
  display: inline-flex;
  align-items: center;
  width: 44px;
  height: 24px;
  flex: 0 0 44px;
  padding: 3px;
  border-radius: 999px;
  background: var(--muted-text);
  transition: background-color 160ms ease;
}

.settings-toggle__thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.22);
  transition: transform 160ms ease;
}

.settings-toggle input:checked + .settings-toggle__track {
  background: #4d6bfe;
}

.settings-toggle input:checked + .settings-toggle__track .settings-toggle__thumb {
  transform: translateX(20px);
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
