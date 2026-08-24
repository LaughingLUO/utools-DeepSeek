import {
  buildPartition,
  clearBindingState,
  getAccountSession,
  getBindingState,
  saveBindingState
} from './accountStore'

const DEEPSEEK_CHAT_URL = 'https://chat.deepseek.com/'
const DEEPSEEK_SIGN_IN_URL = 'https://chat.deepseek.com/sign_in'
const BROWSER_SHELL_PATH = 'browser-shell.html'
const WEBVIEW_PRELOAD_PATH = 'preload/deepseek-webview-preload.js'
const BINDING_TIMEOUT_MS = 10 * 60 * 1000

function getElectronSession() {
  const runtimeRequire = globalThis.require
  if (typeof runtimeRequire !== 'function') {
    throw new Error('electron-runtime-unavailable')
  }

  return runtimeRequire('electron').session
}

function buildWindowTitle(account, mode) {
  return mode === 'bind' ? `绑定账号 - ${account.name}` : `${account.name} - DeepSeek`
}

function buildChatUrl(rawUserToken) {
  if (!rawUserToken) return DEEPSEEK_CHAT_URL
  const encodedToken = Buffer.from(rawUserToken, 'utf8').toString('base64')
  return `${DEEPSEEK_CHAT_URL}#__utools_user_token=${encodeURIComponent(encodedToken)}`
}

function getSessionKey(accountId) {
  return `deepseek/session/${accountId}`
}

function getBindingKey(accountId) {
  return `deepseek/binding/${accountId}`
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

async function removeCookies(partitionSession) {
  const cookies = await partitionSession.cookies.get({}).catch(() => [])
  await Promise.allSettled(cookies.map((cookie) => {
    return partitionSession.cookies.remove(
      `${cookie.secure ? 'https' : 'http'}://${(cookie.domain || 'chat.deepseek.com').replace(/^\./, '')}${cookie.path || '/'}`,
      cookie.name
    )
  }))
}

async function clearPartition(partition) {
  const partitionSession = getElectronSession().fromPartition(partition)
  await removeCookies(partitionSession)
  await partitionSession.clearStorageData({
    storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage']
  }).catch(() => {})
}

async function restoreCookies(partition, cookies) {
  if (!cookies?.length) return
  const partitionSession = getElectronSession().fromPartition(partition)
  await Promise.allSettled(cookies.map((cookie) => {
    return partitionSession.cookies.set(normalizeCookie(cookie))
  }))
}

async function readPartitionCookies(partition) {
  const partitionSession = getElectronSession().fromPartition(partition)
  return partitionSession.cookies.get({}).catch(() => [])
}

function buildShellScript(config) {
  return `
    (() => {
      const config = ${JSON.stringify(config)};
      const webview = document.getElementById('deepseek-webview');
      const status = document.getElementById('deepseek-status');
      const sessionKey = config.sessionKey;
      const bindingKey = config.bindingKey;

      if (!webview) {
        if (status) status.textContent = '未找到 DeepSeek 容器';
        return;
      }

      function setStatus(text) {
        if (status) status.textContent = text;
      }

      function readSession() {
        return window.utools.dbCryptoStorage.getItem(sessionKey) || {};
      }

      function saveSession(payload) {
        const current = readSession();
        window.utools.dbCryptoStorage.setItem(sessionKey, {
          ...current,
          ...payload,
          localStorage: {
            ...(current.localStorage || {}),
            ...(payload.localStorage || {})
          },
          updatedAt: Date.now()
        });
      }

      function updateBindingState(patch) {
        const current = window.utools.dbStorage.getItem(bindingKey) || {};
        window.utools.dbStorage.setItem(bindingKey, {
          ...current,
          accountId: config.accountId,
          updatedAt: Date.now(),
          ...patch
        });
      }

      webview.addEventListener('did-start-loading', () => {
        setStatus(config.mode === 'bind' ? '正在打开 DeepSeek 登录页...' : '正在打开 DeepSeek...');
      });

      webview.addEventListener('dom-ready', () => {
        setStatus(config.mode === 'bind' ? '请在页面中完成登录' : 'DeepSeek 已打开，正在同步会话...');

        if (config.mode === 'chat' && config.rawUserToken) {
          webview.executeJavaScript(\`
            (() => {
              try {
                const rawToken = \${JSON.stringify(config.rawUserToken)};
                const current = localStorage.getItem('userToken');
                if (rawToken && current !== rawToken) {
                  localStorage.setItem('userToken', rawToken);
                  return true;
                }
              } catch (error) {}
              return false;
            })();
          \`).then((changed) => {
            if (changed) {
              setStatus('正在同步当前账号身份...');
              webview.reload();
            }
          }).catch(() => {});
        }
      });

      webview.addEventListener('did-stop-loading', () => {
        setStatus(config.mode === 'bind' ? '等待登录完成并回传 userToken...' : 'DeepSeek 已就绪');
      });

      webview.addEventListener('did-fail-load', () => {
        setStatus('页面加载失败，请稍后重试');
      });

      webview.addEventListener('ipc-message', (event) => {
        if (event.channel !== 'deepseek-session') return;

        const payload = event.args && event.args[0] ? event.args[0] : {};
        saveSession({
          userToken: payload.userToken || '',
          rawUserToken: payload.rawUserToken || '',
          localStorage: payload.localStorage || {},
          authDetectedAt: Date.now()
        });

        if (config.mode === 'bind' && payload.userToken) {
          updateBindingState({
            status: 'ready',
            name: config.accountName,
            userToken: payload.userToken,
            rawUserToken: payload.rawUserToken || '',
            displayName: payload.displayName || ''
          });

          setStatus('已获取 userToken，正在返回插件...');
          window.setTimeout(() => window.close(), 300);
        }
      });

      webview.setAttribute('partition', config.partition);
      webview.setAttribute('preload', config.webviewPreloadPath);
      webview.setAttribute('allowpopups', 'true');
      webview.setAttribute('src', config.targetUrl);
      setStatus(config.mode === 'bind' ? '正在准备登录窗口...' : '正在准备 DeepSeek 窗口...');
    })();
  `
}

function mountShellWindow(browserWindow, account, mode) {
  const sessionData = getAccountSession(account.id) || {}
  const script = buildShellScript({
    accountId: account.id,
    accountName: account.name,
    mode,
    partition: buildPartition(account.id),
    rawUserToken: sessionData.rawUserToken || '',
    sessionKey: getSessionKey(account.id),
    bindingKey: getBindingKey(account.id),
    targetUrl: mode === 'bind' ? DEEPSEEK_SIGN_IN_URL : buildChatUrl(sessionData.rawUserToken || ''),
    webviewPreloadPath: WEBVIEW_PRELOAD_PATH
  })

  browserWindow.webContents.executeJavaScript(script).catch(() => {
    // Keep shell window visible for manual retry if initialization fails.
  })
}

function createWindow(account, mode) {
  let browserWindow = null
  browserWindow = utools.createBrowserWindow(
    BROWSER_SHELL_PATH,
    {
      show: true,
      width: 1440,
      height: 900,
      minWidth: 1080,
      minHeight: 720,
      title: buildWindowTitle(account, mode),
      webPreferences: {
        partition: buildPartition(account.id),
        webviewTag: true
      }
    },
    () => {
      mountShellWindow(browserWindow, account, mode)
    }
  )

  return browserWindow
}

function waitForBindingResult(accountId, browserWindow) {
  const startedAt = Date.now()
  const partition = buildPartition(accountId)

  return new Promise((resolve, reject) => {
    const timer = window.setInterval(async () => {
      const bindingState = getBindingState(accountId)
      const sessionData = getAccountSession(accountId)

      if (bindingState?.status === 'ready' && sessionData?.userToken) {
        const cookies = await readPartitionCookies(partition)
        utools.dbCryptoStorage.setItem(getSessionKey(accountId), {
          ...sessionData,
          cookies,
          updatedAt: Date.now()
        })
        window.clearInterval(timer)
        resolve({
          ...sessionData,
          cookies
        })
        return
      }

      if (browserWindow?.isDestroyed?.()) {
        window.clearInterval(timer)
        reject(new Error('binding-window-closed'))
        return
      }

      if (Date.now() - startedAt > BINDING_TIMEOUT_MS) {
        window.clearInterval(timer)
        reject(new Error('binding-timeout'))
      }
    }, 400)
  })
}

export async function openChatWindow(account) {
  const partition = buildPartition(account.id)
  const sessionData = getAccountSession(account.id) || {}

  await clearPartition(partition)
  await restoreCookies(partition, sessionData.cookies || [])

  return createWindow(account, 'chat')
}

export async function openBindingSession(account) {
  const partition = buildPartition(account.id)
  clearBindingState(account.id)
  await clearPartition(partition)

  saveBindingState(account.id, {
    status: 'binding',
    name: account.name,
    startedAt: Date.now()
  })

  const browserWindow = createWindow(account, 'bind')
  const sessionData = await waitForBindingResult(account.id, browserWindow)
  return sessionData
}

export async function clearAccountBrowserProfile(accountId) {
  clearBindingState(accountId)
  await clearPartition(buildPartition(accountId))
}
