const DEEPSEEK_CHAT_URL = 'https://chat.deepseek.com/'
const DEEPSEEK_SIGN_IN_URL = 'https://chat.deepseek.com/sign_in'

const runtimeArgs = parseRuntimeArgs(process.argv || [])
const accountId = runtimeArgs['ds-account-id'] || ''
const mode = runtimeArgs['ds-mode'] || 'chat'
const partition = `persist:deepseek-${accountId}`
const runtimeRawUserToken = decodeRawToken(runtimeArgs['ds-raw-user-token'] || '')

bootstrap()

async function bootstrap() {
  window.addEventListener('DOMContentLoaded', async () => {
    const webview = document.getElementById('deepseek-webview')
    const status = document.getElementById('deepseek-status')
    const mask = document.getElementById('deepseek-mask')
    if (!webview) return

    const sessionData = loadStoredSession()
    const rawUserToken = runtimeRawUserToken || sessionData?.rawUserToken || buildRawUserToken(sessionData?.userToken || '')
    let syncInFlight = false
    let syncCompleted = false

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
      if (status) {
        status.textContent = mode === 'bind' ? '请在页面中扫码登录' : '正在同步账号会话...'
      }

      void runChatSync()
    })

    webview.addEventListener('ipc-message', async (event) => {
      if (event.channel !== 'deepseek-session') return

      const payload = event.args?.[0] || {}
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
      const markerKey = '__utools_deepseek_token_synced';
      const synced = sessionStorage.getItem(markerKey) === '1';
      const targetUrl = ${JSON.stringify(DEEPSEEK_CHAT_URL)};
      const inSignIn = location.pathname.includes('/sign_in');
      const alreadyReady = current === rawUserToken && !inSignIn;

      if (current !== rawUserToken) {
        localStorage.setItem('userToken', rawUserToken);
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
        ready: current === rawUserToken && !inSignIn,
        changed: current !== rawUserToken,
        redirected: false,
        reloaded: false,
        href: location.href,
        current
      };
    })();
  `
}

async function syncChatSession(webview, rawUserToken) {
  if (!rawUserToken) return null
  return webview.executeJavaScript(buildSessionSyncScript(rawUserToken), true)
}

function revealChatSurface(webview, mask) {
  webview?.classList.remove('is-hidden')
  mask?.classList.add('is-hidden')
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
