let electronSession = null

try {
  electronSession = require('electron').session
} catch (error) {
  electronSession = null
}

const DEEPSEEK_CHAT_URL = 'https://chat.deepseek.com/'
const DEEPSEEK_SIGN_IN_URL = 'https://chat.deepseek.com/sign_in'
const ACCOUNT_STATE_KEY = 'deepseek/accounts/state'
const FAB_POSITION_KEY = 'deepseek/browser-fab-position'
const LAST_CHAT_URL_KEY = 'deepseek:last-chat-url'
const FAB_MARGIN = 12
const FAB_DEFAULT_LEFT = 24
const FAB_DEFAULT_TOP = 88

const runtimeArgs = parseRuntimeArgs(process.argv || [])
const accountId = runtimeArgs['ds-account-id'] || ''
const mode = runtimeArgs['ds-mode'] || 'chat'
const partition = `persist:deepseek-${accountId}`
const runtimeRawUserToken = decodeRawToken(runtimeArgs['ds-raw-user-token'] || '')

bootstrap()

async function bootstrap() {
  window.addEventListener('DOMContentLoaded', async () => {
    initializeTheme()

    const webview = document.getElementById('deepseek-webview')
    const status = document.getElementById('deepseek-status')
    const mask = document.getElementById('deepseek-mask')
    const fab = document.getElementById('deepseek-fab')
    if (!webview) return

    const sessionData = loadStoredSession()
    const rawUserToken = runtimeRawUserToken || sessionData?.rawUserToken || buildRawUserToken(sessionData?.userToken || '')
    let syncInFlight = false
    let syncCompleted = false
    let currentAccountId = accountId
    let currentUrl = mode === 'bind' ? DEEPSEEK_SIGN_IN_URL : DEEPSEEK_CHAT_URL
    let lastChatUrl = readLastChatUrl()

    const syncCurrentUrl = () => {
      currentUrl = getLiveWebviewUrl(webview, currentUrl)
      if (isDeepSeekChatPage(currentUrl)) {
        lastChatUrl = currentUrl
        persistLastChatUrl(lastChatUrl)
      }
      return currentUrl
    }

    const preloadUrl = new URL('./deepseek-webview-preload.js', window.location.href).toString()
    webview.setAttribute('partition', partition)
    webview.setAttribute('preload', preloadUrl)
    webview.setAttribute('allowpopups', 'true')
    webview.setAttribute('additionalarguments', buildWebviewArguments({
      accountId,
      mode,
      rawUserToken
    }).join(' '))
    webview.setAttribute('src', mode === 'bind' ? DEEPSEEK_SIGN_IN_URL : DEEPSEEK_CHAT_URL)

    webview.addEventListener('did-start-loading', () => {
      if (status) {
        status.textContent = mode === 'bind' ? '正在打开登录页面...' : '正在打开 DeepSeek...'
      }

      updateFabState({
        currentUrl: syncCurrentUrl(),
        currentAccountId
      })
    })

    async function runChatSync() {
      if (mode !== 'chat' || !rawUserToken || syncCompleted || syncInFlight) return

      syncInFlight = true
      try {
        const result = await syncChatSession(webview, rawUserToken)
        updateStatusFromSyncResult(status, result)

        if (result?.ready) {
          syncCompleted = true
          revealChatSurface(webview, mask)
        }
      } catch (error) {
        updateStatusFromSyncResult(status, {
          error: error?.message || String(error || '未知错误')
        })
      } finally {
        syncInFlight = false
      }
    }

    webview.addEventListener('did-stop-loading', () => {
      currentUrl = syncCurrentUrl()

      if (status) {
        status.textContent = mode === 'bind' ? '请在页面中扫码登录' : '正在同步账号会话...'
      }

      updateFabState({
        currentUrl,
        currentAccountId
      })
      void runChatSync()
    })

    webview.addEventListener('did-navigate', () => {
      updateFabState({
        currentUrl: syncCurrentUrl(),
        currentAccountId
      })
    })

    webview.addEventListener('did-navigate-in-page', () => {
      updateFabState({
        currentUrl: syncCurrentUrl(),
        currentAccountId
      })
    })

    webview.addEventListener('ipc-message', async (event) => {
      if (event.channel !== 'deepseek-session') return

      const payload = event.args?.[0] || {}
      currentUrl = payload.currentUrl || currentUrl
      saveStoredSession({
        userToken: payload.userToken || '',
        rawUserToken: payload.rawUserToken || '',
        localStorage: payload.localStorage || {},
        authDetectedAt: Date.now()
      })

      if (mode === 'bind' && payload.userToken) {
        updateBindingState({
          status: 'ready',
          name: getBindingState()?.name || '',
          userToken: payload.userToken,
          rawUserToken: payload.rawUserToken || '',
          displayName: payload.displayName || ''
        })

        setTimeout(() => {
          window.close()
        }, 600)
      }

      updateFabState({
        currentUrl,
        currentAccountId
      })
    })

    webview.addEventListener('did-fail-load', () => {
      if (status) {
        status.textContent = '页面加载失败，请重试'
      }
    })

    if (mode === 'chat' && rawUserToken) {
      webview.addEventListener('dom-ready', () => {
        void runChatSync()
      })
    } else {
      revealChatSurface(webview, mask)
    }

    initializeFab({
      fab,
      webview,
      getCurrentUrl: () => syncCurrentUrl(),
      getLastChatUrl: () => lastChatUrl || readLastChatUrl() || DEEPSEEK_CHAT_URL,
      getCurrentAccountId: () => currentAccountId,
      onAccountChange: async (nextAccountId) => {
        const accountsState = listBoundAccounts()
        const targetAccount = accountsState.accounts.find((item) => item.id === nextAccountId)
        if (!targetAccount?.rawUserToken && !targetAccount?.userToken) return

        currentAccountId = targetAccount.id
        const nextRawUserToken = targetAccount.rawUserToken || buildRawUserToken(targetAccount.userToken || '')
        await resetChatSession(webview).catch(() => null)
        currentUrl = DEEPSEEK_CHAT_URL
        lastChatUrl = DEEPSEEK_CHAT_URL
        persistLastChatUrl(lastChatUrl)
        await syncChatSession(webview, nextRawUserToken).catch(() => null)
        webview.loadURL(DEEPSEEK_CHAT_URL)
        updateFabState({
          currentUrl,
          currentAccountId
        })
      }
    })
  })
}

function initializeTheme() {
  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme
    document.body.dataset.theme = theme
  }

  const mediaQueryList = window.matchMedia?.('(prefers-color-scheme: dark)') || null

  if (mediaQueryList) {
    applyTheme(mediaQueryList.matches ? 'dark' : 'light')
    mediaQueryList.addEventListener?.('change', (event) => {
      applyTheme(event.matches ? 'dark' : 'light')
    })
    return
  }

  if (typeof window.utools?.isDarkColors === 'function') {
    applyTheme(window.utools.isDarkColors() ? 'dark' : 'light')
    return
  }

  applyTheme('dark')
}

function parseRuntimeArgs(argv) {
  return argv.reduce((result, arg) => {
    if (!arg.startsWith('--')) return result
    const [key, ...rest] = arg.slice(2).split('=')
    result[key] = rest.join('=')
    return result
  }, {})
}

function decodeRawToken(value) {
  if (!value) return ''
  try {
    return Buffer.from(value, 'base64').toString('utf8')
  } catch (error) {
    return ''
  }
}

function buildWebviewArguments({ accountId, mode, rawUserToken }) {
  const args = [
    `--ds-account-id=${accountId}`,
    `--ds-mode=${mode}`
  ]

  if (rawUserToken) {
    args.push(`--ds-raw-user-token=${Buffer.from(rawUserToken, 'utf8').toString('base64')}`)
  }

  return args
}

function listBoundAccounts() {
  const state = utools.dbCryptoStorage.getItem(ACCOUNT_STATE_KEY)
  if (!state?.accounts?.length) {
    return {
      defaultAccountId: '',
      accounts: []
    }
  }

  const accounts = state.accounts.map((account) => ({
    id: account.id || '',
    name: account.name?.trim() || '未命名账号',
    userToken: account.userToken || '',
    rawUserToken: account.rawUserToken || ''
  }))

  return {
    defaultAccountId: state.defaultAccountId || '',
    accounts
  }
}

function getSessionKey() {
  return `deepseek/session/${accountId}`
}

function getBindingKey() {
  return `deepseek/binding/${accountId}`
}

function loadStoredSession() {
  if (!accountId) return null
  return utools.dbCryptoStorage.getItem(getSessionKey()) || null
}

function saveStoredSession(patch) {
  if (!accountId) return
  const current = loadStoredSession() || {}
  utools.dbCryptoStorage.setItem(getSessionKey(), {
    ...current,
    ...patch,
    localStorage: {
      ...(current.localStorage || {}),
      ...(patch.localStorage || {})
    },
    updatedAt: Date.now()
  })
}

function getBindingState() {
  return utools.dbStorage.getItem(getBindingKey()) || null
}

function updateBindingState(state) {
  if (!accountId) return
  const currentState = getBindingState() || {}
  utools.dbStorage.setItem(getBindingKey(), {
    ...currentState,
    accountId,
    mode,
    updatedAt: Date.now(),
    ...state
  })
}

function buildSessionSyncScript(rawUserToken) {
  return `
    (() => {
      const rawUserToken = ${JSON.stringify(rawUserToken)};
      const current = localStorage.getItem('userToken') || '';
      const envWarnKey = 'closeUnsafeEnvWarn';
      const envWarnValue = JSON.stringify({ value: true, __version: '0' });
      const currentEnvWarnValue = localStorage.getItem(envWarnKey) || '';
      const markerKey = '__utools_deepseek_token_synced';
      const synced = sessionStorage.getItem(markerKey) === '1';
      const targetUrl = ${JSON.stringify(DEEPSEEK_CHAT_URL)};
      const inSignIn = location.pathname.includes('/sign_in');
      const envWarnReady = currentEnvWarnValue === envWarnValue;
      const alreadyReady = current === rawUserToken && envWarnReady && !inSignIn;

      if (current !== rawUserToken) {
        localStorage.setItem('userToken', rawUserToken);
      }

      if (!envWarnReady) {
        localStorage.setItem(envWarnKey, envWarnValue);
      }

      if (alreadyReady) {
        return {
          ready: true,
          changed: false,
          redirected: false,
          reloaded: false,
          href: location.href,
          current
        };
      }

      if (!synced) {
        sessionStorage.setItem(markerKey, '1');

        if (inSignIn) {
          location.replace(targetUrl);
          return { ready: false, changed: true, redirected: true, href: location.href };
        }

        if (current !== rawUserToken) {
          location.reload();
          return { ready: false, changed: true, reloaded: true, href: location.href };
        }
      }

      return {
        ready: current === rawUserToken && envWarnReady && !inSignIn,
        changed: current !== rawUserToken || !envWarnReady,
        redirected: false,
        reloaded: false,
        href: location.href,
        current,
        currentUrl: location.href
      };
    })();
  `
}

function buildSessionResetScript() {
  return `
    (async () => {
      try {
        sessionStorage.clear();
      } catch (error) {}

      try {
        localStorage.clear();
      } catch (error) {}

      try {
        if (window.caches?.keys) {
          const cacheKeys = await window.caches.keys();
          await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
        }
      } catch (error) {}

      try {
        if (window.indexedDB?.databases) {
          const databases = await window.indexedDB.databases();
          await Promise.all(
            (databases || [])
              .map((item) => item?.name)
              .filter(Boolean)
              .map((name) => new Promise((resolve) => {
                try {
                  const request = window.indexedDB.deleteDatabase(name);
                  request.onsuccess = () => resolve(true);
                  request.onerror = () => resolve(false);
                  request.onblocked = () => resolve(false);
                } catch (error) {
                  resolve(false);
                }
              }))
          );
        }
      } catch (error) {}

      return true;
    })();
  `
}

async function syncChatSession(webview, rawUserToken) {
  if (!rawUserToken) return null
  return webview.executeJavaScript(buildSessionSyncScript(rawUserToken), true)
}

async function resetChatSession(webview) {
  if (!webview) return

  const partitionName = webview.getAttribute('partition') || partition
  const storageSession = electronSession?.fromPartition?.(partitionName) || null

  if (storageSession) {
    await storageSession.clearStorageData({
      origin: 'https://chat.deepseek.com',
      storages: [
        'cookies',
        'localstorage',
        'indexdb',
        'serviceworkers',
        'cachestorage',
        'filesystem',
        'websql'
      ]
    }).catch(() => null)

    await storageSession.clearAuthCache?.().catch(() => null)
  }

  await webview.executeJavaScript(buildSessionResetScript(), true).catch(() => null)
}

function revealChatSurface(webview, mask) {
  webview?.classList.remove('is-hidden')
  mask?.classList.add('is-hidden')
  const status = document.getElementById('deepseek-status')
  status?.classList.add('is-hidden')
}

function initializeFab({ fab, webview, getCurrentUrl, getLastChatUrl, getCurrentAccountId, onAccountChange }) {
  if (!fab || !webview) return

  const handle = document.getElementById('deepseek-fab-handle')
  const returnButton = document.getElementById('deepseek-fab-return')
  const copyLinkButton = document.getElementById('deepseek-fab-copy-link')
  const accountCard = document.getElementById('deepseek-fab-account-card')
  const accountDropdown = document.getElementById('deepseek-fab-account-dropdown')
  const dragShield = document.getElementById('deepseek-drag-shield')

  if (!handle || !returnButton || !copyLinkButton || !accountCard || !accountDropdown || !dragShield) return

  hydrateFabPosition(fab)
  renderFabAccounts(getCurrentAccountId())

  const refreshFabState = () => {
    updateFabState({
      currentUrl: getCurrentUrl(),
      currentAccountId: getCurrentAccountId()
    })
  }

  let dragging = false
  let moved = false
  let startX = 0
  let startY = 0
  let pointerOffsetX = 0
  let pointerOffsetY = 0
  let activePointerId = null

  handle.addEventListener('pointerdown', (event) => {
    activePointerId = event.pointerId
    moved = false
    startX = event.clientX
    startY = event.clientY
    pointerOffsetX = event.clientX - fab.offsetLeft
    pointerOffsetY = event.clientY - fab.offsetTop
    event.preventDefault()
  })

  handle.addEventListener('mouseenter', refreshFabState)
  handle.addEventListener('focus', refreshFabState)

  window.addEventListener('pointermove', (event) => {
    if (activePointerId !== event.pointerId) return

    const distance = Math.hypot(event.clientX - startX, event.clientY - startY)
    if (!dragging && distance > 6) {
      dragging = true
      moved = true
      fab.classList.add('is-dragging')
      fab.classList.remove('is-open')
      dragShield.classList.add('is-active')
    }

    if (!dragging) return

    const maxLeft = Math.max(window.innerWidth - fab.offsetWidth, 12)
    const maxTop = Math.max(window.innerHeight - fab.offsetHeight, 12)
    const left = clamp(event.clientX - pointerOffsetX, 12, maxLeft)
    const top = clamp(event.clientY - pointerOffsetY, 12, maxTop)

    fab.style.left = `${left}px`
    fab.style.top = `${top}px`
  })

  const finishPointerInteraction = (event) => {
    if (activePointerId !== event.pointerId) return

    if (dragging) {
      dragging = false
      fab.classList.remove('is-dragging')
      dragShield.classList.remove('is-active')
      snapFabToEdge(fab)
      persistFabPosition(fab)
    } else if (!moved) {
      refreshFabState()
      fab.classList.toggle('is-open')
    }

    activePointerId = null
    moved = false
  }

  window.addEventListener('pointerup', finishPointerInteraction)
  window.addEventListener('pointercancel', finishPointerInteraction)

  window.addEventListener('click', (event) => {
    if (!fab.contains(event.target)) {
      fab.classList.remove('is-open')
      accountCard.classList.remove('is-open')
      accountCard.setAttribute('aria-expanded', 'false')
    }
  })

  copyLinkButton.addEventListener('click', () => {
    const url = getCurrentUrl()
    if (!url) return
    utools.copyText(url)
  })

  returnButton.addEventListener('click', () => {
    webview.loadURL(getLastChatUrl())
    fab.classList.remove('is-open')
  })

  accountCard.addEventListener('click', (event) => {
    event.stopPropagation()
    const nextState = !accountCard.classList.contains('is-open')
    accountCard.classList.toggle('is-open', nextState)
    accountCard.setAttribute('aria-expanded', String(nextState))
  })

  accountCard.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const nextState = !accountCard.classList.contains('is-open')
      accountCard.classList.toggle('is-open', nextState)
      accountCard.setAttribute('aria-expanded', String(nextState))
    }
  })

  accountDropdown.addEventListener('click', async (event) => {
    const option = event.target.closest('[data-account-id]')
    if (!option) return

    event.stopPropagation()
    const nextAccountId = option.dataset.accountId || ''
    if (!nextAccountId || nextAccountId === getCurrentAccountId()) {
      accountCard.classList.remove('is-open')
      accountCard.setAttribute('aria-expanded', 'false')
      return
    }

    await onAccountChange(nextAccountId)
    renderFabAccounts(nextAccountId)
    accountCard.classList.remove('is-open')
    accountCard.setAttribute('aria-expanded', 'false')
    fab.classList.remove('is-open')
  })

  window.addEventListener('resize', () => {
    hydrateFabPosition(fab)
  })
}

function updateFabState({ currentUrl, currentAccountId }) {
  const returnButton = document.getElementById('deepseek-fab-return')

  if (returnButton) {
    const showReturn = shouldShowReturnButton(currentUrl)
    returnButton.classList.toggle('shell-fab__button--hidden', !showReturn)
  }

  renderFabAccounts(currentAccountId)
}

function shouldShowReturnButton(currentUrl) {
  if (!currentUrl) return false

  try {
    const url = new URL(currentUrl)
    if (url.origin !== 'https://chat.deepseek.com') return true
    if (url.pathname.includes('/sign_in')) return true
    return !isDeepSeekChatPage(currentUrl)
  } catch (error) {
    return false
  }
}

function isDeepSeekChatPage(currentUrl) {
  if (!currentUrl) return false

  try {
    const url = new URL(currentUrl)
    if (url.origin !== 'https://chat.deepseek.com') return false
    if (url.pathname.includes('/sign_in')) return false
    if (url.pathname === '/' || url.pathname === '') return true
    if (url.pathname === '/chat' || url.pathname.startsWith('/chat/')) return true
    if (url.pathname === '/a/chat' || url.pathname.startsWith('/a/chat/')) return true
    if (/^\/c\/[^/]+/.test(url.pathname)) return true
    return false
  } catch (error) {
    return false
  }
}

function renderFabAccounts(currentAccountId) {
  const accountsState = listBoundAccounts()
  const accountCard = document.getElementById('deepseek-fab-account-card')
  const accountAvatar = document.getElementById('deepseek-fab-account-avatar')
  const accountName = document.getElementById('deepseek-fab-account-name')
  const accountIdLabel = document.getElementById('deepseek-fab-account-id')
  const accountDropdown = document.getElementById('deepseek-fab-account-dropdown')

  if (!accountCard || !accountAvatar || !accountName || !accountIdLabel || !accountDropdown) return

  const activeId = currentAccountId || accountsState.defaultAccountId || accountsState.accounts[0]?.id || ''
  const activeAccount = accountsState.accounts.find((account) => account.id === activeId) || accountsState.accounts[0] || null

  if (!activeAccount) {
    accountAvatar.textContent = '?'
    accountName.textContent = '暂无账号'
    accountIdLabel.textContent = '请先绑定账号'
    accountDropdown.innerHTML = ''
    return
  }

  accountAvatar.textContent = buildAccountAvatarText(activeAccount.name)
  accountName.innerHTML = `${escapeHtml(activeAccount.name)}${activeAccount.id === accountsState.defaultAccountId ? '<span class="shell-fab__account-badge">默认</span>' : ''}`
  accountIdLabel.textContent = activeAccount.id

  accountDropdown.innerHTML = accountsState.accounts.map((account) => {
    const selected = account.id === activeAccount.id
    return `
      <button
        class="shell-fab__account-option${selected ? ' is-selected' : ''}"
        type="button"
        data-account-id="${escapeHtml(account.id)}"
        role="option"
        aria-selected="${selected ? 'true' : 'false'}"
      >
        <div class="shell-fab__account-avatar">${escapeHtml(buildAccountAvatarText(account.name))}</div>
        <div class="shell-fab__account-main">
          <div class="shell-fab__account-name">${escapeHtml(account.name)}</div>
          <div class="shell-fab__account-id">${escapeHtml(account.id)}</div>
        </div>
        <span class="shell-fab__account-option-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </span>
      </button>
    `
  }).join('')
}

function hydrateFabPosition(fab) {
  const saved = readFabPosition()
  if (saved) {
    const maxLeft = Math.max(window.innerWidth - fab.offsetWidth - FAB_MARGIN, FAB_MARGIN)
    const maxTop = Math.max(window.innerHeight - fab.offsetHeight - FAB_MARGIN, FAB_MARGIN)
    fab.style.left = `${clamp(saved.left, FAB_MARGIN, maxLeft)}px`
    fab.style.top = `${clamp(saved.top, FAB_MARGIN, maxTop)}px`
    fab.dataset.edge = saved.edge || 'left'
    syncFabMenuPlacement(fab)
    return
  }

  fab.style.left = `${FAB_DEFAULT_LEFT}px`
  fab.style.top = `${FAB_DEFAULT_TOP}px`
  fab.dataset.edge = 'left'
  syncFabMenuPlacement(fab)
}

function snapFabToEdge(fab) {
  const maxLeft = Math.max(window.innerWidth - fab.offsetWidth - FAB_MARGIN, FAB_MARGIN)
  const maxTop = Math.max(window.innerHeight - fab.offsetHeight - FAB_MARGIN, FAB_MARGIN)
  const left = clamp(parseFloat(fab.style.left || `${FAB_DEFAULT_LEFT}`), FAB_MARGIN, maxLeft)
  const top = clamp(parseFloat(fab.style.top || `${FAB_DEFAULT_TOP}`), FAB_MARGIN, maxTop)
  const right = window.innerWidth - (left + fab.offsetWidth)
  const bottom = window.innerHeight - (top + fab.offsetHeight)

  const nearestEdge = [
    ['left', left],
    ['right', right],
    ['top', top],
    ['bottom', bottom]
  ].sort((a, b) => a[1] - b[1])[0]?.[0] || 'left'

  if (nearestEdge === 'left') {
    fab.style.left = `${FAB_MARGIN}px`
    fab.style.top = `${top}px`
  } else if (nearestEdge === 'right') {
    fab.style.left = `${maxLeft}px`
    fab.style.top = `${top}px`
  } else if (nearestEdge === 'top') {
    fab.style.left = `${left}px`
    fab.style.top = `${FAB_MARGIN}px`
  } else {
    fab.style.left = `${left}px`
    fab.style.top = `${maxTop}px`
  }

  fab.dataset.edge = nearestEdge
  syncFabMenuPlacement(fab)
}

function persistFabPosition(fab) {
  const payload = {
    left: parseFloat(fab.style.left || `${FAB_DEFAULT_LEFT}`),
    top: parseFloat(fab.style.top || `${FAB_DEFAULT_TOP}`),
    edge: fab.dataset.edge || 'left'
  }

  try {
    localStorage.setItem(FAB_POSITION_KEY, JSON.stringify(payload))
  } catch (error) {
    // Ignore storage write failures.
  }
}

function readFabPosition() {
  try {
    const raw = localStorage.getItem(FAB_POSITION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.left !== 'number' || typeof parsed?.top !== 'number') {
      return null
    }
    return parsed
  } catch (error) {
    return null
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function persistLastChatUrl(url) {
  if (!url) return

  try {
    localStorage.setItem(LAST_CHAT_URL_KEY, url)
  } catch (error) {
    // Ignore storage write failures.
  }
}

function readLastChatUrl() {
  try {
    return localStorage.getItem(LAST_CHAT_URL_KEY) || ''
  } catch (error) {
    return ''
  }
}

function getLiveWebviewUrl(webview, fallback = '') {
  try {
    if (typeof webview?.getURL === 'function') {
      return webview.getURL() || fallback
    }
  } catch (error) {
    // Ignore URL read failures and keep the last known value.
  }

  return fallback
}

function syncFabMenuPlacement(fab) {
  if (!fab) return

  const menu = document.getElementById('deepseek-fab-menu')
  if (!menu) return

  const left = parseFloat(fab.style.left || `${FAB_DEFAULT_LEFT}`)
  const top = parseFloat(fab.style.top || `${FAB_DEFAULT_TOP}`)
  const fabWidth = fab.offsetWidth || 54
  const fabHeight = fab.offsetHeight || 54
  const menuWidth = Math.max(menu.offsetWidth || 220, 220)
  const menuHeight = Math.max(menu.offsetHeight || 120, 120)
  const spaceLeft = left - FAB_MARGIN
  const spaceRight = window.innerWidth - (left + fabWidth) - FAB_MARGIN
  const spaceAbove = top - FAB_MARGIN
  const spaceBelow = window.innerHeight - (top + fabHeight) - FAB_MARGIN
  const edge = fab.dataset.edge || 'left'

  if (edge === 'left') {
    fab.dataset.menuSide = 'right'
    fab.dataset.menuAlign = pickVerticalMenuAlign(spaceAbove, spaceBelow, menuHeight, fabHeight)
    return
  }

  if (edge === 'right') {
    fab.dataset.menuSide = 'left'
    fab.dataset.menuAlign = pickVerticalMenuAlign(spaceAbove, spaceBelow, menuHeight, fabHeight)
    return
  }

  fab.dataset.menuSide = pickHorizontalMenuSide(spaceLeft, spaceRight, menuWidth)
  fab.dataset.menuAlign = pickVerticalMenuAlign(spaceAbove, spaceBelow, menuHeight, fabHeight)
}

function pickHorizontalMenuSide(spaceLeft, spaceRight, menuWidth) {
  if (spaceRight >= menuWidth || spaceRight >= spaceLeft) return 'right'
  return 'left'
}

function pickVerticalMenuAlign(spaceAbove, spaceBelow, menuHeight, fabHeight) {
  const extraHeight = Math.max(menuHeight - fabHeight, 0)
  if (spaceBelow >= extraHeight || spaceBelow >= spaceAbove) return 'top'
  if (spaceAbove >= extraHeight) return 'bottom'
  return 'center'
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function buildAccountAvatarText(name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) return '?'
  return trimmed.slice(0, 1).toUpperCase()
}

function updateStatusFromSyncResult(status, result) {
  if (!status || !result) return

  if (result.error) {
    status.textContent = `账号会话回写失败：${result.error}`
    return
  }

  if (result.redirected) {
    status.textContent = `已写入 userToken，正在从登录页跳转聊天页...`
    return
  }

  if (result.reloaded) {
    status.textContent = `已写入 userToken，正在刷新会话...`
    return
  }

  if (result.ready) {
    status.textContent = `账号会话同步完成`
    return
  }

  if (result.changed) {
    status.textContent = `已写入 userToken，等待页面完成同步...`
    return
  }

  if (typeof result.href === 'string') {
    status.textContent = `userToken 已存在，当前页：${result.href}`
    return
  }

  status.textContent = '账号会话同步完成'
}

function buildRawUserToken(userToken) {
  if (!userToken) return ''
  return JSON.stringify({
    value: userToken,
    __version: '0'
  })
}
