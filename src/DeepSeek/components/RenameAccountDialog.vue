<script setup>
import { computed } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  name: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'update:name',
  'close',
  'save'
])

const canSave = computed(() => props.name.trim().length > 0)
</script>

<template>
  <div
    v-if="open"
    class="dialog-mask"
    @click.self="emit('close')"
  >
    <section class="dialog-panel">
      <div class="dialog-panel__header">
        <h3 class="dialog-panel__title">修改账户名称</h3>

        <button
          class="dialog-panel__close"
          aria-label="关闭"
          @click="emit('close')"
        >
          <span></span>
          <span></span>
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
          @keyup.enter="canSave && emit('save')"
        />
      </label>

      <div class="dialog-panel__actions">
        <button
          class="ghost-button"
          @click="emit('close')"
        >
          取消
        </button>
        <button
          class="primary-button"
          :disabled="!canSave"
          @click="emit('save')"
        >
          保存
        </button>
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
  background: var(--dialog-mask);
  backdrop-filter: blur(8px);
}

.dialog-panel {
  width: min(100%, 520px);
  display: grid;
  gap: 18px;
  padding: 24px;
  border-radius: 26px;
  border: 1px solid var(--panel-border);
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 28%),
    var(--panel-bg);
  box-shadow: var(--panel-shadow);
}

.dialog-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.dialog-panel__title,
.dialog-panel__label {
  margin: 0;
}

.dialog-panel__title {
  font-size: 28px;
}

.dialog-panel__close {
  position: relative;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  border-radius: 14px;
  background: var(--ghost-bg);
  border: 1px solid var(--ghost-border);
}

.dialog-panel__close span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 18px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
  transform-origin: center;
}

.dialog-panel__close span:first-child {
  transform: translate(-50%, -50%) rotate(45deg);
}

.dialog-panel__close span:last-child {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.dialog-panel__field {
  display: grid;
  gap: 10px;
}

.dialog-panel__label {
  color: var(--label-text);
}

.dialog-panel__input {
  height: 48px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: inherit;
  outline: none;
}

.dialog-panel__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 760px) {
  .dialog-panel {
    padding: 18px;
  }
}
</style>
