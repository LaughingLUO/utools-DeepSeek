<script setup>
import { computed, useTemplateRef } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  isBinding: {
    type: Boolean,
    default: false
  },
  bindingName: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'submit'])
const nameInputRef = useTemplateRef('nameInput')

const canSubmit = computed(() => props.modelValue.trim().length > 0)

function handleSubmit() {
  emit('submit', props.modelValue)
}

function focusInput() {
  nameInputRef.value?.focus()
}

defineExpose({
  focusInput
})
</script>

<template>
  <section class="account-form">
    <div class="account-form__header">
      <p class="account-form__eyebrow">账号绑定</p>
      <h2 class="account-form__title">登录一次，之后直接秒开</h2>
      <p class="account-form__desc">
        新账号会在独立浏览器窗口中完成登录，并把会话写入加密存储。
      </p>
    </div>

    <div class="account-form__row">
      <input
        ref="nameInput"
        class="account-form__input"
        :value="modelValue"
        type="text"
        maxlength="40"
        placeholder="给这个账号起个名字，例如：工作号"
        @input="emit('update:modelValue', $event.target.value)"
        @keyup.enter="handleSubmit"
      />
      <button
        class="primary-button"
        :disabled="!canSubmit || isBinding"
        @click="handleSubmit"
      >
        {{ isBinding ? '绑定中...' : '绑定账号' }}
      </button>
    </div>

    <p
      v-if="isBinding"
      class="account-form__status"
    >
      正在等待 {{ bindingName || '当前账号' }} 登录完成，拿到 userToken 后才会加入下面的账号列表。
    </p>
  </section>
</template>

<style scoped>
.account-form {
  display: grid;
  gap: 18px;
  padding: 24px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 24px;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(14px);
}

.account-form__header {
  display: grid;
  gap: 8px;
}

.account-form__eyebrow {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7dd3fc;
}

.account-form__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.15;
}

.account-form__desc {
  margin: 0;
  color: rgba(226, 232, 240, 0.78);
}

.account-form__row {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.account-form__input {
  min-width: 0;
  height: 48px;
  padding: 0 14px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 14px;
  outline: none;
  background: rgba(15, 23, 42, 0.72);
  color: inherit;
}

.account-form__status {
  margin: 0;
  color: #7dd3fc;
}

@media (max-width: 760px) {
  .account-form__row {
    grid-template-columns: 1fr;
  }
}
</style>
