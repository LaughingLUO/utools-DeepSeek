import { computed, reactive, shallowRef } from 'vue'
import {
  buildPartition,
  clearAccountSession,
  clearBindingState,
  createAccountDraft,
  deleteAccount,
  getAccountSession,
  listAccountsState,
  setDefaultAccount,
  upsertAccount
} from '../services/accountStore'
import {
  clearAccountBrowserProfile,
  openBindingSession,
  openChatWindow
} from '../services/browserWindows'

export function useDeepSeekAccounts() {
  const accounts = shallowRef([])
  const defaultAccountId = shallowRef('')
  const bindingAccountIds = shallowRef([])
  const activeBindingName = shallowRef('')
  const isSubmitting = shallowRef(false)

  const formState = reactive({
    name: ''
  })

  const hasAccounts = computed(() => accounts.value.length > 0)
  const isBinding = computed(() => bindingAccountIds.value.length > 0 || isSubmitting.value)

  const defaultAccount = computed(() => {
    return accounts.value.find((item) => item.id === defaultAccountId.value) || null
  })

  function refresh() {
    const state = listAccountsState()
    accounts.value = state.accounts.map((account) => {
      const session = getAccountSession(account.id)
      return {
        ...account,
        userToken: session?.userToken || '',
        rawUserToken: session?.rawUserToken ?? ''
      }
    })
    defaultAccountId.value = state.defaultAccountId
  }

  function notify(message) {
    utools.showNotification(message)
  }

  function getBindingName(name) {
    return name?.trim() || ''
  }

  async function beginBinding(name) {
    const bindingName = getBindingName(name)
    if (!bindingName) {
      notify('请先输入账号名称，再开始绑定')
      return
    }

    isSubmitting.value = true
    activeBindingName.value = bindingName

    const draftAccount = createAccountDraft(bindingName)
    bindingAccountIds.value = [draftAccount.id]
    try {
      await openBindingSession(draftAccount)
      upsertAccount({
        ...draftAccount,
        partition: buildPartition(draftAccount.id),
        status: 'ready'
      })
      formState.name = ''
      refresh()
      notify('账号绑定成功')
    } catch (error) {
      notify('登录窗口已关闭，或未能拿到 userToken')
    } finally {
      bindingAccountIds.value = []
      activeBindingName.value = ''
      isSubmitting.value = false
    }
  }

  function launchAccount(account) {
    openChatWindow(account).catch(() => {
      notify('打开 DeepSeek 窗口失败，请重试')
    })
  }

  async function launchDefaultAccount() {
    if (!defaultAccount.value) {
      notify('请先输入账号名称，再点击“绑定账号”')
      return
    }
    launchAccount(defaultAccount.value)
  }

  function makeDefault(accountId) {
    setDefaultAccount(accountId)
    refresh()
  }

  async function logoutAccount(account) {
    await clearAccountBrowserProfile(account.id)
    clearAccountSession(account.id)
    clearBindingState(account.id)
    upsertAccount({
      ...account,
      status: 'logged_out'
    })
    refresh()
    notify(`${account.name} 已注销`)
  }

  async function rebindAccount(account) {
    activeBindingName.value = account.name
    bindingAccountIds.value = [account.id]
    isSubmitting.value = true

    try {
      await openBindingSession(account)
      upsertAccount({
        ...account,
        status: 'ready'
      })
      refresh()
      notify('账号重新绑定成功')
    } catch (error) {
      notify('登录窗口已关闭，或未能拿到 userToken')
    } finally {
      bindingAccountIds.value = []
      activeBindingName.value = ''
      isSubmitting.value = false
    }
  }

  async function removeAccount(account) {
    await clearAccountBrowserProfile(account.id)
    deleteAccount(account.id)
    refresh()
  }

  refresh()

  return {
    accounts,
    defaultAccountId,
    defaultAccount,
    formState,
    hasAccounts,
    isBinding,
    isSubmitting,
    activeBindingName,
    beginBinding,
    launchAccount,
    launchDefaultAccount,
    makeDefault,
    logoutAccount,
    rebindAccount,
    removeAccount,
    bindingAccountIds
  }
}
