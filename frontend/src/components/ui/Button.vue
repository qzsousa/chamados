<template>
  <button :class="buttonClasses" :disabled="disabled" :type="type" @click="$emit('click', $event)">
    <slot v-if="!loading">
      <component v-if="icon" :is="icon" class="btn-icon" />
      <span v-if="$slots.default"><slot /></span>
    </slot>
    <span v-else class="btn-loading">
      <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1" stroke-linecap="round"/></svg>
      <span>Carregando...</span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  icon?: any
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  type: 'button'
})

const buttonClasses = computed(() => [
  'btn',
  `btn--${props.variant}`,
  `btn--${props.size}`,
  { 'btn--disabled': props.disabled, 'btn--loading': props.loading }
].join(' '))
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  border-radius: var(--radius-md);
  font-weight: 600;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.btn:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }

.btn--sm { padding: var(--spacing-xs) var(--spacing-sm); font-size: var(--font-size-xs); }
.btn--md { padding: var(--spacing-sm) var(--spacing-md); font-size: var(--font-size-sm); }
.btn--lg { padding: var(--spacing-md) var(--spacing-lg); font-size: var(--font-size-base); }

.btn--primary { background: var(--accent-primary); color: white; }
.btn--primary:hover:not(.btn--disabled) { background: var(--accent-primary-hover); }

.btn--secondary { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border-color); }
.btn--secondary:hover:not(.btn--disabled) { background: var(--bg-hover); color: var(--text-primary); border-color: var(--border-light); }

.btn--danger { background: rgba(239, 68, 68, 0.1); color: var(--accent-danger); border: 1px solid var(--accent-danger); }
.btn--danger:hover:not(.btn--disabled) { background: var(--accent-danger); color: white; }

.btn--ghost { background: transparent; color: var(--text-secondary); }
.btn--ghost:hover:not(.btn--disabled) { background: var(--bg-hover); color: var(--text-primary); }

.btn--disabled { opacity: 0.5; cursor: not-allowed; }
.btn--loading { color: transparent; }

.btn-icon { width: 16px; height: 16px; flex-shrink: 0; }

.btn-loading {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: inherit;
}

.spinner {
  width: 16px;
  height: 16px;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>