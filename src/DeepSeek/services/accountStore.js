const ACCOUNT_STATE_KEY = 'deepseek/accounts'
const SESSION_PREFIX = 'deepseek/session/'
const BINDING_PREFIX = 'deepseek/binding/'

function createEmptyState() {
  return {
    defaultAccountId: '',
    accounts: []
  }
}

function readState() {
  return utools.dbStorage.getItem(ACCOUNT_STATE_KEY) || createEmptyState()
}

function writeState(state) {
  utools.dbStorage.setItem(ACCOUNT_STATE_KEY, state)
}

function buildAccountId() {
  return `deepseek_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
}

export function buildPartition(accountId) {
  return `persist:deepseek-${accountId}`
}

export function buildBindingPartition(accountId) {
  return `persist:deepseek-bind-${accountId}-${Date.now()}`
}

export function listAccountsState() {
  const state = readState()
  const accounts = [...(state.accounts || [])].sort((left, right) => {
    return (right.updatedAt || 0) - (left.updatedAt || 0)
  })

  return {
    defaultAccountId: state.defaultAccountId || '',
    accounts
  }
}

export function createAccountDraft(name) {
  const now = Date.now()
  const account = {
    id: buildAccountId(),
    name: name?.trim() || '',
    partition: '',
    status: 'draft',
    createdAt: now,
    updatedAt: now
  }
  account.partition = buildPartition(account.id)
  return account
}

export function upsertAccount(account) {
  const state = readState()
  const nextAccounts = [...(state.accounts || [])]
  const existingIndex = nextAccounts.findIndex((item) => item.id === account.id)

  if (existingIndex >= 0) {
    nextAccounts.splice(existingIndex, 1, {
      ...nextAccounts[existingIndex],
      ...account,
      updatedAt: Date.now()
    })
  } else {
    nextAccounts.push({
      ...account,
      updatedAt: Date.now()
    })
  }

  const nextState = {
    ...state,
    accounts: nextAccounts
  }

  if (!nextState.defaultAccountId && nextAccounts.length) {
    nextState.defaultAccountId = nextAccounts[0].id
  }

  writeState(nextState)
  return getAccountById(account.id)
}

export function getAccountById(accountId) {
  return listAccountsState().accounts.find((item) => item.id === accountId) || null
}

export function setDefaultAccount(accountId) {
  const state = readState()
  writeState({
    ...state,
    defaultAccountId: accountId
  })
}

export function deleteAccount(accountId) {
  const state = readState()
  const accounts = (state.accounts || []).filter((item) => item.id !== accountId)
  const defaultAccountId = state.defaultAccountId === accountId
    ? accounts[0]?.id || ''
    : state.defaultAccountId

  writeState({
    defaultAccountId,
    accounts
  })

  clearAccountSession(accountId)
  clearBindingState(accountId)
}

export function getAccountSession(accountId) {
  return utools.dbCryptoStorage.getItem(`${SESSION_PREFIX}${accountId}`) || null
}

export function saveAccountSession(accountId, sessionData) {
  const current = getAccountSession(accountId) || {}
  utools.dbCryptoStorage.setItem(`${SESSION_PREFIX}${accountId}`, {
    ...current,
    ...sessionData,
    localStorage: {
      ...(current.localStorage || {}),
      ...(sessionData.localStorage || {})
    },
    updatedAt: Date.now()
  })
}

export function clearAccountSession(accountId) {
  utools.dbCryptoStorage.removeItem(`${SESSION_PREFIX}${accountId}`)
}

export function getBindingState(accountId) {
  return utools.dbStorage.getItem(`${BINDING_PREFIX}${accountId}`) || null
}

export function saveBindingState(accountId, bindingState) {
  const current = getBindingState(accountId) || {}
  utools.dbStorage.setItem(`${BINDING_PREFIX}${accountId}`, {
    ...current,
    accountId,
    updatedAt: Date.now(),
    ...bindingState
  })
}

export function clearBindingState(accountId) {
  utools.dbStorage.removeItem(`${BINDING_PREFIX}${accountId}`)
}
