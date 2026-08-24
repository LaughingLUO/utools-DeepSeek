const { session: electronSession } = require('electron')

const DEEPSEEK_CHAT_URL = 'https://chat.deepseek.com/'
const DEEPSEEK_SIGN_IN_URL = 'https://chat.deepseek.com/sign_in'

const runtimeArgs = parseRuntimeArgs(process.argv || [])
const accountId = runtimeArgs['ds-account-id'] || ''
const mode = runtimeArgs['ds-mode'] || 'chat'
const partition = `persist:deepseek-${accountId}`

bootstrap()

async function bootstrap() {
  window.addEventListener('DOMContentLoaded', async () => {
    const webview = document.getElementById('deepseek-webview')
    const status = document.getElementById('deepseek-status')
    if (!webview) return

    const sessionData = loadStoredSession()
    const rawUserToken = sessionData?.rawUserToken || buildRawUserToken(sessionData?.userToken || '')

    await preparePartition({
      partition,
      mode,
      cookies: sessionData?.cookies || []
    })

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
    })

    webview.addEventListener('did-stop-loading', () => {
      if (status) {
        status.textContent = mode === 'bind' ? '请在页面中扫码登录' : '正在同步账号会话...'
      }
    })

    webview.addEventListener('ipc-message', async (event) => {
      if (event.channel !== 'deepseek-session') return

      const payload = event.args?.[0] || {}
      const cookies = await readPartitionCookies(partition)
      saveStoredSession({
        userToken: payload.userToken || '',
        rawUserToken: payload.rawUserToken || '',
        localStorage: payload.localStorage || {},
        cookies,
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
    })

    webview.addEventListener('did-fail-load', () => {
      if (status) {
        status.textContent = '页面加载失败，请重试'
      }
    })
  })
}

function parseRuntimeArgs(argv) {
  return argv.reduce((result, arg) => {
    if (!arg.startsWith('--')) return result
    const [key, ...rest] = arg.slice(2).split('=')
    result[key] = rest.join('=')
    return result
  }, {})
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

async function preparePartition({ partition, mode, cookies }) {
  const partitionSession = electronSession.fromPartition(partition)
  await clearPartition(partitionSession)

  if (mode !== 'chat' || !cookies?.length) return

  await Promise.allSettled(cookies.map((cookie) => {
    return partitionSession.cookies.set(normalizeCookie(cookie))
  }))
}

async function clearPartition(partitionSession) {
  const cookies = await partitionSession.cookies.get({})

  await Promise.allSettled(cookies.map((cookie) => {
    return partitionSession.cookies.remove(
      `${cookie.secure ? 'https' : 'http'}://${(cookie.domain || 'chat.deepseek.com').replace(/^\./, '')}${cookie.path || '/'}`,
      cookie.name
    )
  }))

  await partitionSession.clearStorageData({
    origin: DEEPSEEK_CHAT_URL,
    storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage']
  }).catch(() => {})
}

async function readPartitionCookies(partition) {
  const partitionSession = electronSession.fromPartition(partition)
  return partitionSession.cookies.get({}).catch(() => [])
}

function normalizeCookie(cookie) {
  const domain = (cookie.domain || 'chat.deepseek.com').replace(/^\./, '')
  const routePath = cookie.path || '/'
  return {
    url: `${cookie.secure ? 'https' : 'http'}://${domain}${routePath}`,
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: routePath,
    secure: Boolean(cookie.secure),
    httpOnly: Boolean(cookie.httpOnly),
    expirationDate: cookie.session ? undefined : cookie.expirationDate,
    sameSite: cookie.sameSite
  }
}

function buildRawUserToken(userToken) {
  if (!userToken) return ''
  return JSON.stringify({
    value: userToken,
    __version: '0'
  })
}
