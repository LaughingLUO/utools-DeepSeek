<script setup>
import { onMounted, shallowRef } from 'vue'
import DeepSeekWorkspace from './DeepSeek/index.vue'

const route = shallowRef('')
const enterAction = shallowRef({})

onMounted(() => {
  window.utools.onPluginEnter((action) => {
    route.value = action.code
    enterAction.value = action
  })

  window.utools.onPluginOut(() => {
    route.value = ''
  })
})
</script>

<template>
  <DeepSeekWorkspace
    v-if="route === 'DeepSeek'"
    :enter-action="enterAction"
  />
</template>
