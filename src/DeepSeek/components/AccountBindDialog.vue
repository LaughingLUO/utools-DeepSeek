<script setup>
import { computed } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'create'
  },
  name: {
    type: String,
    default: ''
  },
  isCapturing: {
    type: Boolean,
    default: false
  },
  statusText: {
    type: String,
    default: ''
  },
  sessionData: {
    type: Object,
    default: null
  },
  canStartCapture: {
    type: Boolean,
    default: false
  },
  canSave: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'update:name',
  'close',
  'start-login',
  'save'
])

const dialogTitle = computed(() => {
  return props.mode === 'rebind' ? '重新绑定账号' : '新增绑定账号'
})
</script>

<template>
  <div
    v-if="open"
    class="dialog-mask"
    @click.self="emit('close')"
  >
    <section class="dialog-panel">
      <div class="dialog-panel__header">
        <div>
          <p class="dialog-panel__eyebrow">账号绑定</p>
          <h3 class="dialog-panel__title">{{ dialogTitle }}</h3>
        </div>

        <button
          class="ghost-button"
          :disabled="isCapturing"
          @click="emit('close')"
        >
          关闭
        </button>
      </div>

      <label class="dialog-panel__field">
        <span class="dialog-panel__label">账户名称</span>
        <input
          class="dialog-panel__input"
          :value="name"
          type="text"
          maxlength="40"
          placeholder="例如：工作号 / 个人号"
          @input="emit('update:name', $event.target.value)"
        />
      </label>

      <div class="dialog-panel__actions">
        <button
          class="secondary-button"
          :disabled="!canStartCapture"
          @click="emit('start-login')"
        >
          {{ isCapturing ? '等待扫码登录...' : '跳转登录' }}
        </button>
        <button
          class="primary-button"
          :disabled="!canSave"
          @click="emit('save')"
        >
          保存
        </button>
      </div>

      <div class="dialog-panel__status">
        <p class="dialog-panel__status-text">
          {{ statusText || '先输入账户名称，再点击“跳转登录”，扫码完成后回到这里保存。' }}
        </p>

        <div
          v-if="sessionData?.userToken"
          class="dialog-panel__token-card"
        >
          <p class="dialog-panel__token-label">已捕获 userToken</p>
          <p class="dialog-panel__token-value">{{ sessionData.userToken }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(2, 6, 23, 0.68);
  backdrop-filter: blur(8px);
}

.dialog-panel {
  width: min(100%, 620px);
  display: grid;
  gap: 18px;
  padding: 24px;
  border-radius: 26px;
  border: 1px solid rgba(96, 165, 250, 0.18);
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 28%),
    #0f172a;
  box-shadow: 0 24px 56px rgba(2, 6, 23, 0.4);
}

.dialog-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.dialog-panel__eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7dd3fc;
}

.dialog-panel__title,
.dialog-panel__label,
.dialog-panel__status-text,
.dialog-panel__token-label,
.dialog-panel__token-value {
  margin: 0;
}

.dialog-panel__title {
  font-size: 28px;
}

.dialog-panel__field {
  display: grid;
  gap: 10px;
}

.dialog-panel__label {
  color: rgba(226, 232, 240, 0.82);
}

.dialog-panel__input {
  height: 48px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(15, 23, 42, 0.88);
  color: inherit;
  outline: none;
}

.dialog-panel__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.dialog-panel__status {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.dialog-panel__status-text {
  color: rgba(226, 232, 240, 0.74);
  line-height: 1.7;
}

.dialog-panel__token-card {
  display: grid;
  gap: 6px;
}

.dialog-panel__token-label {
  color: #7dd3fc;
  font-size: 12px;
}

.dialog-panel__token-value {
  font-size: 12px;
  line-height: 1.7;
  color: #fca5a5;
  word-break: break-all;
}

@media (max-width: 760px) {
  .dialog-panel {
    padding: 18px;
  }

  .dialog-panel__header {
    flex-direction: column;
  }
}
</style>
