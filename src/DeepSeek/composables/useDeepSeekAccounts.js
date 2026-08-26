import { computed, reactive, shallowRef } from 'vue'
import {
  createAccountDraft,
  deleteAccount,
  getAccountById,
  listAccountsState,
  renameAccount,
  setDefaultAccount,
  upsertAccount
} from '../services/accountStore'
import {
  cleanupBindingWindow,
  hasBindingWindow,
  navigateBindingWindowToChat,
  openBindingWindow,
  openChatWindow,
  readBindingCookies,
  readBindingSession
} from '../services/browserWindows'

function createDialogState() {
  return {
    open: false,
    mode: 'create',
    accountId: '',
    name: '',
    isCapturing: false,
    capturedSession: null,
    statusText: ''
  }
}

function createRenameDialogState() {
  return {
    open: false,
    accountId: '',
    name: ''
  }
}

function buildRawUserToken(userToken) {
  if (!userToken) return ''
  return JSON.stringify({
    value: userToken,
    __version: '0'
  })
}

function ensureRawUserTokenPayload(rawValue, userToken) {
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (typeof parsed?.value === 'string' && parsed.value.trim()) {
          return trimmed
        }
      } catch (error) {
        // Ignore invalid json.
      }
    }
  }

  return buildRawUserToken(userToken)
}

export function useDeepSeekAccounts() {
  const accounts = shallowRef([])
  const defaultAccountId = shallowRef('')
  const dialogState = reactive(createDialogState())
  const renameDialogState = reactive(createRenameDialogState())

  let bindingWindowId = null
  let bindingPollTimer = null
  let bindingPolling = false
  let bindingNavigateTriggered = false

  const hasAccounts = computed(() => accounts.value.length > 0)
  const defaultAccount = computed(() => {
    return accounts.value.find((item) => item.id === defaultAccountId.value) || null
  })
  const canStartCapture = computed(() => {
    return dialogState.name.trim().length > 0 && !dialogState.isCapturing
  })
  const canSavePending = computed(() => {
    return Boolean(dialogState.capturedSession?.userToken) && !dialogState.isCapturing
  })

  function refresh() {
    const state = listAccountsState()
    accounts.value = state.accounts
    defaultAccountId.value = state.defaultAccountId
  }

  function notify(message) {
    utools.showNotification(message)
  }

  function stopBindingPolling() {
    if (bindingPollTimer) {
      window.clearInterval(bindingPollTimer)
      bindingPollTimer = null
    }
    bindingPolling = false
    bindingNavigateTriggered = false
  }

  async function releaseBindingWindow() {
    const currentWindowId = bindingWindowId
    bindingWindowId = null

    if (!currentWindowId) return

    await cleanupBindingWindow(currentWindowId).catch(() => {})
  }

  function resetDialog() {
    stopBindingPolling()
    Object.assign(dialogState, createDialogState())
  }

  function openCreateDialog() {
    resetDialog()
    dialogState.open = true
  }

  function openRenameDialog(account) {
    renameDialogState.open = true
    renameDialogState.accountId = account.id
    renameDialogState.name = account.name
  }

  function openRebindDialog(account) {
    resetDialog()
    dialogState.open = true
    dialogState.mode = 'rebind'
    dialogState.accountId = account.id
    dialogState.name = account.name
    dialogState.statusText = `准备重新绑定 ${account.name}`
  }

  function closeDialog() {
    if (dialogState.isCapturing) return
    resetDialog()
  }

  function closeRenameDialog() {
    Object.assign(renameDialogState, createRenameDialogState())
  }

  function updateDialogName(name) {
    dialogState.name = name
  }

  function updateRenameDialogName(name) {
    renameDialogState.name = name
  }

  function startBindingPolling(accountName) {
    stopBindingPolling()

    bindingPollTimer = window.setInterval(async () => {
      if (bindingPolling || !bindingWindowId) return
      bindingPolling = true

      try {
        if (!hasBindingWindow(bindingWindowId)) {
          stopBindingPolling()
          dialogState.isCapturing = false
          dialogState.statusText = '登录窗口已关闭，请重新点击“跳转登录”。'
          bindingWindowId = null
          notify('登录窗口已关闭，请重新发起登录')
          return
        }

        const sessionData = await readBindingSession(bindingWindowId, accountName)
        if (!sessionData?.userToken) {
          const cookies = await readBindingCookies(bindingWindowId).catch(() => [])
          const hasAuthCookies = cookies.some((cookie) => {
            const lowerName = String(cookie?.name || '').toLowerCase()
            return /(token|auth|session|jwt)/.test(lowerName)
          })

          if (
            hasAuthCookies &&
            !bindingNavigateTriggered &&
            typeof sessionData?.currentUrl === 'string' &&
            sessionData.currentUrl.includes('/sign_in')
          ) {
            bindingNavigateTriggered = true
            dialogState.statusText = '检测到登录态已建立，正在从登录页跳转回聊天页并抓取 userToken。'
            await navigateBindingWindowToChat(bindingWindowId).catch(() => {})
          }

          return
        }

        dialogState.capturedSession = sessionData
        dialogState.isCapturing = false
        dialogState.statusText = `已拿到 ${accountName} 的 userToken，请点击保存。`
        stopBindingPolling()
        await releaseBindingWindow()
      } catch (error) {
        stopBindingPolling()
        dialogState.isCapturing = false
        dialogState.statusText = '读取登录结果失败，请重新点击“跳转登录”。'
        bindingWindowId = null
        notify('读取登录结果失败，请重新发起登录')
      } finally {
        bindingPolling = false
      }
    }, 1200)
  }

  async function startBindingFlow() {
    const accountName = dialogState.name.trim()
    if (!accountName) {
      notify('请先输入账户名称')
      return
    }

    dialogState.capturedSession = null
    dialogState.isCapturing = true
    dialogState.statusText = '正在打开 DeepSeek 登录窗口，请扫码登录。'

    try {
      await releaseBindingWindow()
      const browserWindow = await openBindingWindow()
      bindingWindowId = browserWindow.id
      dialogState.statusText = '登录窗口已打开，请在新窗口扫码；拿到 userToken 后会自动回传这里。'
      startBindingPolling(accountName)
    } catch (error) {
      dialogState.isCapturing = false
      dialogState.statusText = '登录窗口打开失败，请重试。'
      notify('登录窗口打开失败，请重试')
    }
  }

  async function saveBinding() {
    const accountName = dialogState.name.trim()
    const sessionData = dialogState.capturedSession

    if (!accountName) {
      notify('请先输入账户名称')
      return
    }

    if (!sessionData?.userToken) {
      notify('请先点击“跳转登录”并完成扫码')
      return
    }

    const existingAccount = dialogState.accountId
      ? getAccountById(dialogState.accountId)
      : null
    const draftAccount = existingAccount || createAccountDraft(accountName)

    upsertAccount({
      ...draftAccount,
      name: accountName,
      status: 'ready',
      userToken: sessionData.userToken,
      rawUserToken: ensureRawUserTokenPayload(sessionData.rawUserToken, sessionData.userToken)
    })

    refresh()
    resetDialog()
    notify(existingAccount ? '账号重新绑定成功' : '账号绑定成功')
  }

  function launchAccount(account) {
    openChatWindow(account).catch(() => {
      notify('打开 DeepSeek 窗口失败，请重试')
    })
  }

  function launchDefaultAccount() {
    if (!defaultAccount.value) {
      notify('请先在设置里绑定一个账号')
      return
    }

    launchAccount(defaultAccount.value)
  }

  function makeDefault(accountId) {
    setDefaultAccount(accountId)
    refresh()
  }

  function saveRename() {
    const trimmedName = renameDialogState.name.trim()
    if (!trimmedName) {
      notify('账户名称不能为空')
      return
    }

    const currentAccount = getAccountById(renameDialogState.accountId)
    if (!currentAccount) {
      closeRenameDialog()
      return
    }

    if (trimmedName === currentAccount.name) {
      closeRenameDialog()
      return
    }

    renameAccount(currentAccount.id, trimmedName)
    refresh()
    closeRenameDialog()
  }

  async function removeAccount(account) {
    deleteAccount(account.id)
    refresh()
  }

  refresh()

  return {
    accounts,
    defaultAccountId,
    defaultAccount,
    dialogState,
    renameDialogState,
    hasAccounts,
    canSavePending,
    canStartCapture,
    openCreateDialog,
    openRenameDialog,
    openRebindDialog,
    closeDialog,
    closeRenameDialog,
    updateDialogName,
    updateRenameDialogName,
    startBindingFlow,
    saveBinding,
    launchAccount,
    launchDefaultAccount,
    makeDefault,
    saveRename,
    removeAccount,
    refresh
  }
}
