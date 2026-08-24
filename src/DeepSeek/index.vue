<script setup>
import { computed, useTemplateRef } from 'vue'
import AccountCard from './components/AccountCard.vue'
import AccountForm from './components/AccountForm.vue'
import { useDeepSeekAccounts } from './composables/useDeepSeekAccounts'

defineProps({
  enterAction: {
    type: Object,
    required: true
  }
})

const {
  accounts,
  bindingAccountIds,
  defaultAccount,
  defaultAccountId,
  formState,
  hasAccounts,
  isBinding,
  activeBindingName,
  beginBinding,
  launchAccount,
  launchDefaultAccount,
  logoutAccount,
  makeDefault,
  rebindAccount,
  removeAccount
} = useDeepSeekAccounts()

const bindingSet = computed(() => new Set(bindingAccountIds.value))
const accountFormRef = useTemplateRef('accountFormRef')

function handlePrimaryAction() {
  if (defaultAccount.value) {
    launchDefaultAccount()
    return
  }

  accountFormRef.value?.focusInput?.()
  utools.showNotification('先输入账号名称，再点击“绑定账号”')
}
</script>

<template>
  <main class="deepseek-page">
    <section class="deepseek-page__hero">
      <div class="deepseek-page__hero-copy">
        <p class="deepseek-page__eyebrow">uTools x DeepSeek</p>
        <h1 class="deepseek-page__title">
          多账号托管版 DeepSeek 插件
        </h1>
        <p class="deepseek-page__desc">
          现在可以单独管理多个账号，设置默认用户，并通过
          <code>createBrowserWindow</code>
          打开独立聊天窗口。
        </p>
      </div>

      <div class="deepseek-page__hero-actions">
        <button
          class="primary-button"
          @click="handlePrimaryAction"
        >
          {{ defaultAccount ? `打开默认账号：${defaultAccount.name}` : '先绑定一个账号' }}
        </button>
      </div>
    </section>

    <AccountForm
      ref="accountFormRef"
      v-model="formState.name"
      :is-binding="isBinding"
      :binding-name="activeBindingName"
      @submit="beginBinding"
    />

    <section class="account-list">
      <div class="account-list__header">
        <h2 class="account-list__title">已绑定账号</h2>
        <p class="account-list__meta">
          {{ hasAccounts ? `共 ${accounts.length} 个账号` : '还没有账号，先绑定一个吧' }}
        </p>
      </div>

      <div
        v-if="hasAccounts"
        class="account-list__grid"
      >
        <AccountCard
          v-for="account in accounts"
          :key="account.id"
          :account="account"
          :is-default="account.id === defaultAccountId"
          :is-binding="bindingSet.has(account.id)"
          @launch="launchAccount(account)"
          @set-default="makeDefault(account.id)"
          @rebind="rebindAccount(account)"
          @logout="logoutAccount(account)"
          @remove="removeAccount(account)"
        />
      </div>

      <div
        v-else
        class="account-list__empty"
      >
        绑定完成后，这里会显示账号卡片、默认账号状态和账号切换入口。
      </div>
    </section>
  </main>
</template>

<style scoped>
.deepseek-page {
  display: grid;
  gap: 24px;
  padding: 26px;
}

.deepseek-page__hero {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
  padding: 28px;
  border-radius: 28px;
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.24), transparent 34%),
    linear-gradient(145deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.84));
  border: 1px solid rgba(125, 211, 252, 0.18);
}

.deepseek-page__hero-copy {
  display: grid;
  gap: 10px;
}

.deepseek-page__eyebrow {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #7dd3fc;
}

.deepseek-page__title {
  margin: 0;
  font-size: 40px;
  line-height: 1.04;
}

.deepseek-page__desc {
  margin: 0;
  max-width: 680px;
  color: rgba(226, 232, 240, 0.78);
  line-height: 1.7;
}

.deepseek-page__hero-actions {
  display: flex;
  align-items: end;
  justify-content: end;
}

.account-list {
  display: grid;
  gap: 16px;
}

.account-list__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.account-list__title {
  margin: 0;
  font-size: 22px;
}

.account-list__meta {
  margin: 0;
  color: rgba(226, 232, 240, 0.66);
}

.account-list__grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

.account-list__empty {
  padding: 28px;
  border-radius: 22px;
  border: 1px dashed rgba(148, 163, 184, 0.3);
  color: rgba(226, 232, 240, 0.7);
}

@media (max-width: 920px) {
  .deepseek-page__hero {
    grid-template-columns: 1fr;
  }

  .deepseek-page__hero-actions {
    justify-content: start;
  }
}

@media (max-width: 760px) {
  .deepseek-page {
    padding: 16px;
  }

  .deepseek-page__title {
    font-size: 32px;
  }

  .account-list__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
