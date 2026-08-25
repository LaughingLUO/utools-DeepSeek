<script setup>
import { onMounted, shallowRef } from 'vue'
import { openDefaultChatWindow } from './services/browserWindows'

defineProps({
  enterAction: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['need-settings'])
const statusText = shallowRef('正在打开默认账号聊天窗口...')

onMounted(() => {
  openDefaultChatWindow()
    .then(() => {
      window.utools.outPlugin()
    })
    .catch((error) => {
      if (error?.message === 'default-account-missing') {
        statusText.value = '未找到默认账号，请先到设置页绑定并设为默认账号。'
        emit('need-settings')
        return
      }

      statusText.value = `默认账号聊天窗口打开失败：${error?.message || '未知错误'}`
    })
})
</script>

<template>
  <section class="launch-state">
    <p class="launch-state__text">{{ statusText }}</p>
  </section>
</template>

<style scoped>
.launch-state {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.launch-state__text {
  margin: 0;
  padding: 14px 18px;
  border-radius: 16px;
  color: rgba(226, 232, 240, 0.82);
  background: rgba(15, 23, 42, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
}
</style>
