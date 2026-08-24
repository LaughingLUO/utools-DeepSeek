<script setup>
import { computed } from 'vue'

const props = defineProps({
  account: {
    type: Object,
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isBinding: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'launch',
  'set-default',
  'rebind',
  'logout',
  'remove'
])

const statusLabel = computed(() => {
  if (props.isBinding) return '绑定中'
  if (props.account.status === 'logged_out') return '已注销'
  if (props.account.status === 'ready') return '可使用'
  return '待绑定'
})
</script>

<template>
  <article class="account-card">
    <div class="account-card__top">
      <div>
        <div class="account-card__name-row">
          <h3 class="account-card__name">{{ account.name }}</h3>
          <span
            v-if="isDefault"
            class="account-card__badge"
          >
            默认
          </span>
        </div>
        <p class="account-card__meta">
          {{ statusLabel }}
        </p>
        <p class="account-card__token">
          userToken: {{ account.userToken || '未取到' }}
        </p>
        <p class="account-card__token account-card__token--muted">
          rawUserToken: {{ account.rawUserToken || '空' }}
        </p>
      </div>

      <button
        class="secondary-button"
        :disabled="isBinding"
        @click="emit('launch')"
      >
        打开 DeepSeek
      </button>
    </div>

    <div class="account-card__actions">
      <button
        class="ghost-button"
        :disabled="isDefault"
        @click="emit('set-default')"
      >
        设为默认
      </button>
      <button
        class="ghost-button"
        @click="emit('rebind')"
      >
        重新绑定
      </button>
      <button
        class="ghost-button"
        @click="emit('logout')"
      >
        注销
      </button>
      <button
        class="ghost-button ghost-button--danger"
        @click="emit('remove')"
      >
        删除
      </button>
    </div>
  </article>
</template>

<style scoped>
.account-card {
  display: grid;
  gap: 18px;
  padding: 20px;
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.72);
}

.account-card__top {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.account-card__name-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.account-card__name {
  margin: 0;
  font-size: 18px;
}

.account-card__badge {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.18);
  color: #7dd3fc;
  font-size: 12px;
}

.account-card__meta {
  margin: 8px 0 0;
  color: rgba(226, 232, 240, 0.68);
}

.account-card__token {
  margin: 8px 0 0;
  color: #f87171;
  word-break: break-all;
  font-size: 12px;
}

.account-card__token--muted {
  color: #fca5a5;
}

.account-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 760px) {
  .account-card__top {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
