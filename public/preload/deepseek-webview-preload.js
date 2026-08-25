const { ipcRenderer } = require('electron')

const DEEPSEEK_CHAT_URL = 'https://chat.deepseek.com/'
const TOKEN_KEYS = ['userToken', 'token', 'accessToken', 'auth_token', 'Authorization']
const runtimeArgs = parseRuntimeArgs(process.argv || [])
const mode = runtimeArgs['ds-mode'] || 'chat'
const rawUserToken = ensureRawUserTokenPayload(resolveRawUserToken())

bootstrap()

function bootstrap() {
  if (mode === 'chat' && rawUserToken) {
    syncInjectedToken()
  }

  captureSession()
  window.addEventListener('DOMContentLoaded', () => {
    if (mode === 'chat' && rawUserToken) {
      syncInjectedToken()
    }
    captureSession()
  })
  window.addEventListener('load', () => {
    if (mode === 'chat' && rawUserToken) {
      syncInjectedToken()
    }
    captureSession()
  })
  setInterval(captureSession, 1500)
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

function readTokenFromHash() {
  const hash = window.location.hash || ''
  const match = hash.match(/#__utools_user_token=([^&]+)/)
  if (!match?.[1]) return ''

  const decoded = decodeRawToken(decodeURIComponent(match[1]))
  if (!decoded) return ''

  try {
    history.replaceState(null, '', `${location.pathname}${location.search}`)
  } catch (error) {
    // Ignore hash cleanup failures.
  }

  return decoded
}

function resolveRawUserToken() {
  return readTokenFromHash() || decodeRawToken(runtimeArgs['ds-raw-user-token'] || '')
}

function buildRawUserToken(userToken) {
  if (!userToken) return ''
  return JSON.stringify({
    value: userToken,
    __version: '0'
  })
}

function ensureRawUserTokenPayload(rawValue) {
  const normalizedToken = normalizeTokenValue(rawValue)
  if (!normalizedToken) return ''

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed?.value === normalizedToken) {
          return trimmed
        }
      } catch (error) {
        // Ignore invalid json.
      }
    }
  }

  return buildRawUserToken(normalizedToken)
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

function syncInjectedToken() {
  try {
    const currentRawUserToken = localStorage.getItem('userToken') || ''
    if (currentRawUserToken === rawUserToken) {
      return
    }

    localStorage.setItem('userToken', rawUserToken)

    const hasReloaded = sessionStorage.getItem('__utools_deepseek_token_synced') === '1'
    if (hasReloaded) {
      return
    }

    sessionStorage.setItem('__utools_deepseek_token_synced', '1')

    if (location.pathname.includes('/sign_in')) {
      location.replace(DEEPSEEK_CHAT_URL)
      return
    }

    location.reload()
  } catch (error) {
    // Ignore storage injection failures.
  }
}

function snapshotLocalStorage() {
  const data = {}
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key) continue
    data[key] = localStorage.getItem(key)
  }
  return data
}

function extractUserToken(localStorageState) {
  for (const key of TOKEN_KEYS) {
    const rawValue = localStorageState[key]
    const userToken = normalizeTokenValue(rawValue)
    if (userToken) {
      return {
        userToken,
        rawUserToken: rawValue ?? ''
      }
    }
  }

  return {
    userToken: '',
    rawUserToken: ''
  }
}

function captureSession() {
  const localStorageState = snapshotLocalStorage()
  const { userToken, rawUserToken } = extractUserToken(localStorageState)
  if (!userToken) return

  ipcRenderer.sendToHost('deepseek-session', {
    userToken,
    rawUserToken,
    localStorage: {
      userToken: rawUserToken
    },
    displayName: inferDisplayName(localStorageState)
  })
}

function inferDisplayName(localStorageState) {
  const guessKeys = ['userInfo', 'user', 'profile', 'account', 'deepseek_user']

  for (const key of guessKeys) {
    const raw = localStorageState[key]
    if (!raw) continue

    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed?.name === 'string' && parsed.name.trim()) return parsed.name.trim()
      if (typeof parsed?.nickname === 'string' && parsed.nickname.trim()) return parsed.nickname.trim()
      if (typeof parsed?.email === 'string' && parsed.email.trim()) return parsed.email.trim()
    } catch (error) {
      // Ignore non-json values.
    }
  }

  return ''
}
