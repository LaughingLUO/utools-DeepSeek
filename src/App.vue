<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import DeepSeek from './DeepSeek/index.vue';

const route = ref('')
const enterAction = ref({})

onMounted(() => {
  window.utools.onPluginEnter((action) => {
    route.value = action.code
    enterAction.value = action
  })
  window.utools.onPluginOut((isKill) => {
    route.value = ''
  })
})
</script>

<template>
  <template v-if="route === 'DeepSeek'">
    <DeepSeek :enterAction="enterAction" />
  </template>
</template>
