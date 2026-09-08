<template>
  <div :class="cardClasses">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'elevated' | 'outlined'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  padding: 'md'
})

const cardClasses = computed(() => [
  'card',
  `card--${props.variant}`,
  `card--padding-${props.padding}`
].join(' '))
</script>

<style scoped>
.card {
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  transition: all var(--transition-fast);
}

.card--default { border: 1px solid var(--border-color); }
.card--elevated { border: none; box-shadow: var(--shadow-md); }
.card--outlined { border: 1px solid var(--border-color); }

.card--padding-none { padding: 0; }
.card--padding-sm { padding: var(--spacing-sm); }
.card--padding-md { padding: var(--spacing-md); }
.card--padding-lg { padding: var(--spacing-lg); }
</style>