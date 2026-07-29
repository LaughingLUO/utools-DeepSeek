<script lang="ts" setup>
import { onMounted, onBeforeUnmount } from 'vue'

defineProps({
  enterAction: {
    type: Object,
    required: true
  }
})

const DEEPSEEK_URL = 'https://chat.deepseek.com/'
const DB_SESSION_ID = 'deepseek_session'
const TOKEN_KEYS = ['userToken', 'token', 'accessToken', 'auth_token', 'Authorization']

let monitorTimer: any = null
let capturedSession = false
let ubrowserId: number | null = null

onMounted(() => {
  const session = loadSession()
  capturedSession = !!session
  openDeepSeek(session)
})

onBeforeUnmount(() => {
  stopMonitor()
})

function loadSession(): any {
  return utools.db.get(DB_SESSION_ID)
}

function saveSession(data: { localStorage: any; cookies: any }) {
  const cookies = (data.cookies || []).map((c: any) => ({ name: c.name, value: c.value }))
  const existing: any = utools.db.get(DB_SESSION_ID)
  const doc = existing
    ? { ...existing, _id: DB_SESSION_ID, localStorage: data.localStorage, cookies }
    : { _id: DB_SESSION_ID, localStorage: data.localStorage, cookies }
  utools.db.put(doc)
  capturedSession = true
}

function clearSession() {
  const existing: any = utools.db.get(DB_SESSION_ID)
  if (existing) utools.db.remove(existing)
}

function openDeepSeek(session: any) {
  const chain = utools.ubrowser.goto(DEEPSEEK_URL)

  if (session) {
    if (session.cookies?.length) {
      chain.setCookies(session.cookies)
    }
    if (session.localStorage) {
      chain.evaluate((data: any) => {
        for (const key of Object.keys(data)) {
          localStorage.setItem(key, data[key])
        }
      }, session.localStorage)
    }
  } else {
    chain
      .wait(() => TOKEN_KEYS.some(k => !!localStorage.getItem(k)), 300000)
      .evaluate(() => {
        const data: any = {}
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key) data[key] = localStorage.getItem(key)
        }
        return data
      })
      .cookies()
  }

  chain.run({ show: true, width: 1280, height: 720 }).then((results: any[]) => {
    // 记录 ubrowser 实例 ID，用于精准监控
    const instance = results[results.length - 1]
    ubrowserId = instance?.id || null

    if (!capturedSession) {
      let ls: any = null
      let ck: any = null
      for (let i = 0; i < results.length - 1; i++) {
        const v = results[i]
        if (Array.isArray(v)) ck = v
        else if (v && typeof v === 'object' && !v.id) ls = v
      }
      if (ls || ck) saveSession({ localStorage: ls, cookies: ck })
    }
    // 链跑完了 → ubrowser 已空闲 → 开始监听关闭
    startMonitor()
  }).catch(() => {
    clearSession()
    utools.outPlugin()
  })
}

function startMonitor() {
  stopMonitor()
  monitorTimer = setInterval(() => {
    if (!ubrowserId) return
    const idle = utools.getIdleUBrowsers()
    const alive = idle.some((b: any) => b.id === ubrowserId)
    if (!alive) {
      stopMonitor()
      utools.outPlugin()
    }
  }, 2000)
}

function stopMonitor() {
  if (monitorTimer) {
    clearInterval(monitorTimer)
    monitorTimer = null
  }
}
</script>

<template>
  <div />
</template>
