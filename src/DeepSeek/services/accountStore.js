const ACCOUNT_STATE_KEY = 'deepseek/accounts/state'
const LEGACY_ACCOUNT_STATE_KEY = 'deepseek/accounts'
const LEGACY_SESSION_PREFIX = 'deepseek/session/'

function createEmptyState() {
  return {
    defaultAccountId: '',
    accounts: []
  }
}

function buildAccountId() {
  return `deepseek_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
}

function normalizeAccount(account = {}) {
  const now = Date.now()
  return {
    id: account.id || buildAccountId(),
    name: account.name?.trim() || '',
    status: account.status || 'ready',
    userToken: account.userToken || '',
    rawUserToken: account.rawUserToken || '',
    createdAt: account.createdAt || now,
    updatedAt: account.updatedAt || now
  }
}

function readLegacyState() {
  const legacyState = utools.dbStorage.getItem(LEGACY_ACCOUNT_STATE_KEY)
  if (!legacyState?.accounts?.length) {
    return createEmptyState()
  }

  const accounts = legacyState.accounts.map((account) => {
    const session = utools.dbCryptoStorage.getItem(`${LEGACY_SESSION_PREFIX}${account.id}`) || {}
    return normalizeAccount({
      ...account,
      userToken: session.userToken || '',
      rawUserToken: session.rawUserToken || ''
    })
  })

  return {
    defaultAccountId: legacyState.defaultAccountId || accounts[0]?.id || '',
    accounts
  }
}

function readState() {
  const encryptedState = utools.dbCryptoStorage.getItem(ACCOUNT_STATE_KEY)
  if (encryptedState?.accounts) {
    return {
      defaultAccountId: encryptedState.defaultAccountId || '',
      accounts: encryptedState.accounts.map((account) => normalizeAccount(account))
    }
  }

  const migratedState = readLegacyState()
  if (migratedState.accounts.length) {
    writeState(migratedState)
  }
  return migratedState
}

function writeState(state) {
  const accounts = (state.accounts || []).map((account) => normalizeAccount(account))
  utools.dbCryptoStorage.setItem(ACCOUNT_STATE_KEY, {
    defaultAccountId: state.defaultAccountId || accounts[0]?.id || '',
    accounts
  })
}

function writeLegacyState(state) {
  utools.dbStorage.setItem(LEGACY_ACCOUNT_STATE_KEY, state)
}

export function buildPartition(accountId) {
  return `persist:deepseek-${accountId}`
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
  return normalizeAccount({
    id: buildAccountId(),
    name,
    status: 'draft',
    createdAt: now,
    updatedAt: now
  })
}

export function upsertAccount(account) {
  const state = readState()
  const nextAccounts = [...(state.accounts || [])]
  const existingIndex = nextAccounts.findIndex((item) => item.id === account.id)
  const nextAccount = normalizeAccount({
    ...(existingIndex >= 0 ? nextAccounts[existingIndex] : {}),
    ...account,
    updatedAt: Date.now()
  })

  if (existingIndex >= 0) {
    nextAccounts.splice(existingIndex, 1, nextAccount)
  } else {
    nextAccounts.push(nextAccount)
  }

  writeState({
    defaultAccountId: state.defaultAccountId || nextAccount.id,
    accounts: nextAccounts
  })

  return getAccountById(nextAccount.id)
}

export function getAccountById(accountId) {
  return listAccountsState().accounts.find((item) => item.id === accountId) || null
}

export function getDefaultAccount() {
  const state = listAccountsState()
  if (!state.defaultAccountId) {
    return state.accounts[0] || null
  }

  return state.accounts.find((item) => item.id === state.defaultAccountId) || state.accounts[0] || null
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

  const legacyState = utools.dbStorage.getItem(LEGACY_ACCOUNT_STATE_KEY)
  if (legacyState?.accounts?.length) {
    writeLegacyState({
      defaultAccountId,
      accounts: legacyState.accounts.filter((item) => item.id !== accountId)
    })
  }

  utools.dbCryptoStorage.removeItem(`${LEGACY_SESSION_PREFIX}${accountId}`)
}

export function renameAccount(accountId, name) {
  const state = readState()
  const nextName = String(name || '').trim()
  if (!nextName) return null

  const accountIndex = (state.accounts || []).findIndex((item) => item.id === accountId)
  if (accountIndex < 0) return null

  const nextAccounts = [...state.accounts]
  nextAccounts.splice(accountIndex, 1, normalizeAccount({
    ...nextAccounts[accountIndex],
    name: nextName,
    updatedAt: Date.now()
  }))

  writeState({
    ...state,
    accounts: nextAccounts
  })

  return getAccountById(accountId)
}
