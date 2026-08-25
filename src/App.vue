<script setup>
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import DeepSeekLaunch from './DeepSeek/DeepSeekLaunch.vue'
import DeepSeekWorkspace from './DeepSeek/index.vue'

const LAST_ROUTE_KEY = 'deepseek:last-route'
const route = shallowRef(readLastRoute())
const enterAction = shallowRef({})
const theme = shallowRef(resolveTheme())
let mediaQueryList = null
let handleThemeChange = null
let pluginEnterRegistered = false
let pluginOutRegistered = false

function readLastRoute() {
  try {
    const cachedRoute = sessionStorage.getItem(LAST_ROUTE_KEY)
    if (cachedRoute === 'DeepSeek' || cachedRoute === 'DeepSeekSettings') {
      return cachedRoute
    }
  } catch (error) {
    // Ignore storage read failures.
  }

  return 'DeepSeekSettings'
}

function updateRoute(nextRoute) {
  route.value = nextRoute

  try {
    sessionStorage.setItem(LAST_ROUTE_KEY, nextRoute)
  } catch (error) {
    // Ignore storage write failures.
  }
}

function resolveTheme() {
  const mediaTheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  if (typeof mediaTheme === 'boolean') {
    return mediaTheme ? 'dark' : 'light'
  }

  if (typeof window.utools?.isDarkColors === 'function') {
    return window.utools.isDarkColors() ? 'dark' : 'light'
  }

  return 'dark'
}

function applyTheme(nextTheme) {
  theme.value = nextTheme
  document.documentElement.dataset.theme = nextTheme
  document.body.dataset.theme = nextTheme
}

function handleLaunchFallback() {
  updateRoute('DeepSeekSettings')
}

function registerPluginLifecycle() {
  if (!pluginEnterRegistered) {
    window.utools.onPluginEnter((action) => {
      enterAction.value = action
      updateRoute(action.code)
    })
    pluginEnterRegistered = true
  }

  if (!pluginOutRegistered) {
    window.utools.onPluginOut(() => {
      route.value = readLastRoute()
    })
    pluginOutRegistered = true
  }
}

registerPluginLifecycle()

onMounted(() => {
  applyTheme(resolveTheme())

  mediaQueryList = window.matchMedia?.('(prefers-color-scheme: dark)') || null
  handleThemeChange = (event) => {
    applyTheme(event.matches ? 'dark' : 'light')
  }
  mediaQueryList?.addEventListener?.('change', handleThemeChange)
})

onBeforeUnmount(() => {
  if (handleThemeChange) {
    mediaQueryList?.removeEventListener?.('change', handleThemeChange)
  }
})
</script>

<template>
  <main
    class="app-shell"
    :data-theme="theme"
  >
    <template v-if="route === 'DeepSeek'">
      <DeepSeekLaunch
        :enter-action="enterAction"
        @need-settings="handleLaunchFallback"
      />
    </template>

    <template v-if="route === 'DeepSeekSettings'">
      <DeepSeekWorkspace
        entry-code="DeepSeekSettings"
        :enter-action="enterAction"
      />
    </template>
  </main>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}
</style>
