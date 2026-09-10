import { buildPartition, getDefaultAccount } from './accountStore'

const DEEPSEEK_CHAT_URL = 'https://chat.deepseek.com/'
const DEEPSEEK_SIGN_IN_URL = 'https://chat.deepseek.com/sign_in'
const BROWSER_SHELL_PATH = 'browser-shell.html'
const BROWSER_WINDOW_PRELOAD_PATH = 'preload/deepseek-browser-window.js'
const WEBVIEW_PRELOAD_PATH = 'preload/deepseek-webview-preload.js'

function buildWindowTitle(accountName) {
  return `${accountName} - DeepSeek`
}

function normalizeTokenValue(rawValue) {
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim()
    if (!trimmed) return ''

    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return normalizeTokenValue(JSON.parse(trimmed))
      } catch (error) {
        return trimmed
      }
    }

    return trimmed
  }

  if (rawValue && typeof rawValue === 'object') {
    if (typeof rawValue.value === 'string' && rawValue.value.trim()) return rawValue.value.trim()
    if (typeof rawValue.token === 'string' && rawValue.token.trim()) return rawValue.token.trim()
    if (typeof rawValue.accessToken === 'string' && rawValue.accessToken.trim()) return rawValue.accessToken.trim()
  }

  return ''
}

function isUBrowserInstance(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.id === 'number' &&
    typeof value.url === 'string'
  )
}

function extractUBrowserInstance(results) {
  if (isUBrowserInstance(results)) return results
  if (!Array.isArray(results)) return null

  for (let index = results.length - 1; index >= 0; index -= 1) {
    if (isUBrowserInstance(results[index])) {
      return results[index]
    }
  }

  return null
}

function extractFirstPayload(results) {
  if (!Array.isArray(results)) return results
  if (!results.length) return null

  if (results.length === 1 && isUBrowserInstance(results[0])) {
    return null
  }

  return results[0]
}

function extractCookiePayload(results) {
  const payload = extractFirstPayload(results)
  if (Array.isArray(payload)) {
    return payload
  }

  return []
}

function encodeRuntimeArgument(value) {
  const input = value || ''
  const bytes = new TextEncoder().encode(input)
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
}

function buildRuntimeWindowId(accountId) {
  return `${accountId || 'deepseek'}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function ensureBrowserWindowActive(browserWindow) {
  if (!browserWindow) return browserWindow

  for (let index = 0; index < 6; index += 1) {
    try {
      if (browserWindow.isMinimized?.()) {
        browserWindow.restore?.()
      }
    } catch (error) {}

    try {
      browserWindow.show?.()
    } catch (error) {}

    try {
      browserWindow.focus?.()
    } catch (error) {}

    await wait(80)

    try {
      if (browserWindow.isFocused?.()) {
        return browserWindow
      }
    } catch (error) {}
  }

  return browserWindow
}

function sendWindowPinState(browserWindow, runtimeWindowId, pinned) {
  try {
    browserWindow.webContents?.send?.('deepseek-window-pin-state', {
      windowId: runtimeWindowId,
      pinned
    })
  } catch (error) {}
}

function bindAlwaysOnTopBridge(browserWindow, runtimeWindowId) {
  const onToggle = window.services?.onDeepSeekWindowPinToggle
  if (typeof onToggle !== 'function') return

  onToggle((payload) => {
    if (!payload || payload.windowId !== runtimeWindowId) return

    const nextPinned = Boolean(payload.pinned)

    try {
      browserWindow.setAlwaysOnTop?.(nextPinned)
    } catch (error) {}

    let actualPinned = nextPinned
    try {
      actualPinned = browserWindow.isAlwaysOnTop?.() ?? nextPinned
    } catch (error) {}

    sendWindowPinState(browserWindow, runtimeWindowId, actualPinned)
  })
}

function createWindow(account) {
  return new Promise((resolve, reject) => {
    let resolved = false
    const runtimeWindowId = buildRuntimeWindowId(account.id)

    const finalizeResolve = async (browserWindow) => {
      if (resolved) return
      resolved = true
      try {
        browserWindow.maximize?.()
      } catch (error) {}
      const activeWindow = await ensureBrowserWindowActive(browserWindow)
      sendWindowPinState(activeWindow, runtimeWindowId, false)
      window.setTimeout(() => resolve(activeWindow), 120)
    }

    try {
      const browserWindow = utools.createBrowserWindow(
        BROWSER_SHELL_PATH,
        {
          show: false,
          width: 1440,
          height: 900,
          minWidth: 660,
          minHeight: 440,
          title: buildWindowTitle(account.name),
          webPreferences: {
            partition: buildPartition(account.id),
            preload: BROWSER_WINDOW_PRELOAD_PATH,
            webviewTag: true,
            additionalArguments: [
              `--ds-account-id=${account.id}`,
              `--ds-window-id=${runtimeWindowId}`,
              '--ds-mode=chat',
              `--ds-raw-user-token=${encodeRuntimeArgument(account.rawUserToken || '')}`
            ]
          }
        },
        () => {
          void finalizeResolve(browserWindow)
        }
      )

      bindAlwaysOnTopBridge(browserWindow, runtimeWindowId)

      window.setTimeout(() => {
        if (resolved) return
        void finalizeResolve(browserWindow)
      }, 1200)
    } catch (error) {
      reject(error)
    }
  })
}

function buildSessionProbe(accountName) {
  return function probe(boundAccountName) {
    function normalize(rawValue) {
      if (typeof rawValue === 'string') {
        const trimmed = rawValue.trim()
        if (!trimmed) return ''

        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            return normalize(JSON.parse(trimmed))
          } catch (error) {
            return trimmed
          }
        }

        return trimmed
      }

      if (rawValue && typeof rawValue === 'object') {
        if (typeof rawValue.value === 'string' && rawValue.value.trim()) return rawValue.value.trim()
        if (typeof rawValue.token === 'string' && rawValue.token.trim()) return rawValue.token.trim()
        if (typeof rawValue.accessToken === 'string' && rawValue.accessToken.trim()) return rawValue.accessToken.trim()
      }

      return ''
    }

    function snapshotStorage(storage) {
      const data = {}
      try {
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index)
          if (!key) continue
          data[key] = storage.getItem(key)
        }
      } catch (error) {
        // Ignore storage snapshot failures.
      }
      return data
    }

    function resolveToken(storageState) {
      const exactKeys = [
        'userToken',
        'token',
        'accessToken',
        'access_token',
        'authToken',
        'auth_token',
        'jwt',
        'idToken',
        'id_token'
      ]

      for (const key of exactKeys) {
        const rawValue = storageState[key]
        const tokenValue = normalize(rawValue)
        if (tokenValue) {
          return {
            token: tokenValue,
            rawValue: rawValue || '',
            sourceKey: key
          }
        }
      }

      for (const [key, rawValue] of Object.entries(storageState)) {
        const lowerKey = key.toLowerCase()
        if (!/(token|auth|jwt|session)/.test(lowerKey)) continue

        const tokenValue = normalize(rawValue)
        if (tokenValue) {
          return {
            token: tokenValue,
            rawValue: rawValue || '',
            sourceKey: key
          }
        }
      }

      return {
        token: '',
        rawValue: '',
        sourceKey: ''
      }
    }

    const localStorageState = snapshotStorage(localStorage)
    const sessionStorageState = snapshotStorage(sessionStorage)
    const localToken = resolveToken(localStorageState)
    const sessionToken = resolveToken(sessionStorageState)
    const tokenState = localToken.token ? localToken : sessionToken
    const userToken = tokenState.token
    const rawUserToken = tokenState.rawValue
    let displayName = ''

    const guessKeys = ['userInfo', 'user', 'profile', 'account', 'deepseek_user']
    for (const storageState of [localStorageState, sessionStorageState]) {
      for (const key of guessKeys) {
        const raw = storageState[key]
        if (!raw) continue

        try {
          const parsed = JSON.parse(raw)
          if (typeof parsed?.name === 'string' && parsed.name.trim()) {
            displayName = parsed.name.trim()
            break
          }
          if (typeof parsed?.nickname === 'string' && parsed.nickname.trim()) {
            displayName = parsed.nickname.trim()
            break
          }
          if (typeof parsed?.email === 'string' && parsed.email.trim()) {
            displayName = parsed.email.trim()
            break
          }
        } catch (error) {
          // Ignore non-json values.
        }
      }

      if (displayName) break
    }

    return {
      accountName: boundAccountName,
      userToken,
      rawUserToken,
      displayName,
      sourceKey: tokenState.sourceKey,
      currentUrl: location.href,
      localStorage: {
        userToken: rawUserToken,
        keys: Object.keys(localStorageState)
      },
      sessionStorage: {
        userToken: sessionToken.rawValue || '',
        keys: Object.keys(sessionStorageState)
      }
    }
  }
}

export async function openChatWindow(account) {
  return createWindow(account)
}

export async function openDefaultChatWindow() {
  const defaultAccount = getDefaultAccount()
  if (!defaultAccount?.rawUserToken && !defaultAccount?.userToken) {
    throw new Error('default-account-missing')
  }

  return openChatWindow(defaultAccount)
}

export async function openBindingWindow() {
  const results = await utools.ubrowser
    .goto(DEEPSEEK_CHAT_URL)
    .evaluate(() => {
      try {
        sessionStorage.clear()
      } catch (error) {}

      try {
        localStorage.clear()
      } catch (error) {}

      return true
    })
    .clearCookies(DEEPSEEK_CHAT_URL)
    .goto(DEEPSEEK_SIGN_IN_URL)
    .viewport(1280, 860)
    .run({
      show: true,
      width: 1280,
      height: 860,
      center: true,
      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true,
      titleBarStyle: 'default'
    })

  const instance = extractUBrowserInstance(results)
  if (!instance?.id) {
    throw new Error('binding-window-open-failed')
  }

  return instance
}

export function hasBindingWindow(ubrowserId) {
  return utools.getIdleUBrowsers().some((item) => item.id === ubrowserId)
}

export async function readBindingSession(ubrowserId, accountName) {
  const results = await utools.ubrowser
    .evaluate(buildSessionProbe(accountName))
    .run(ubrowserId)

  const payload = extractFirstPayload(results)
  if (!payload) {
    return null
  }

  return {
    ...payload,
    userToken: normalizeTokenValue(payload.userToken),
    rawUserToken: payload.rawUserToken || ''
  }
}

export async function readBindingCookies(ubrowserId) {
  const results = await utools.ubrowser
    .cookies({ domain: 'chat.deepseek.com' })
    .run(ubrowserId)

  return extractCookiePayload(results)
}

export async function navigateBindingWindowToChat(ubrowserId) {
  await utools.ubrowser
    .goto(DEEPSEEK_CHAT_URL)
    .run(ubrowserId)
}

export async function cleanupBindingWindow(ubrowserId) {
  await utools.ubrowser
    .evaluate(() => {
      try {
        sessionStorage.clear()
      } catch (error) {}

      try {
        localStorage.clear()
      } catch (error) {}

      return true
    })
    .evaluate(() => {
      try {
        if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
          indexedDB.databases().then((databases) => {
            databases
              .map((item) => item?.name)
              .filter(Boolean)
              .forEach((name) => {
                try {
                  indexedDB.deleteDatabase(name)
                } catch (error) {}
              })
          }).catch(() => {})
        }
      } catch (error) {}

      try {
        if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
          caches.keys().then((keys) => {
            keys.forEach((key) => {
              try {
                caches.delete(key)
              } catch (error) {}
            })
          }).catch(() => {})
        }
      } catch (error) {}

      return true
    })
    .clearCookies(DEEPSEEK_CHAT_URL)
    .goto('about:blank')
    .run(ubrowserId)
    .catch(() => {})

  utools.clearUBrowserCache()

  await utools.ubrowser
    .hide()
    .run(ubrowserId)
    .catch(() => {})
}

export async function clearAccountBrowserProfile(accountId) {
  void accountId
}
