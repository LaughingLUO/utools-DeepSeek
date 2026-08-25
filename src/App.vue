<script setup>
import { onMounted, shallowRef } from 'vue'
import DeepSeekLaunch from './DeepSeek/DeepSeekLaunch.vue'
import DeepSeekWorkspace from './DeepSeek/index.vue'

const route = shallowRef('')
const enterAction = shallowRef({})

function handleLaunchFallback() {
  route.value = 'DeepSeekSettings'
}

onMounted(() => {
  window.utools.onPluginEnter((action) => {
    enterAction.value = action

    route.value = action.code
  })

  window.utools.onPluginOut(() => {
    route.value = ''
  })
})
</script>

<template>
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
</template>
