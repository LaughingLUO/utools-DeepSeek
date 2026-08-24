const { ipcRenderer } = require('electron')

const TOKEN_KEYS = ['userToken', 'token', 'accessToken', 'auth_token', 'Authorization']
const runtimeArgs = parseRuntimeArgs(process.argv || [])
const mode = runtimeArgs['ds-mode'] || 'chat'
const rawUserToken = resolveRawUserToken()

bootstrap()

function bootstrap() {
  if (mode === 'chat' && rawUserToken) {
    try {
      localStorage.setItem('userToken', rawUserToken)
    } catch (error) {
      // Ignore storage injection failures.
    }
  }

  captureSession()
  window.addEventListener('DOMContentLoaded', captureSession)
  window.addEventListener('load', captureSession)
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
