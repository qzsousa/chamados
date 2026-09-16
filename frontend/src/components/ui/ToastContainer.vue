<template>
  <div class="toast-container" role="region" aria-live="polite" aria-label="Notificações">
    <div v-for="toast in toasts" :key="toast.id" :class="['toast', toast.type, { persistent: toast.persistent }]" @click="!toast.persistent && remove(toast.id)">
      <div class="toast-icon">
        <svg v-if="toast.type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <svg v-else-if="toast.type === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <svg v-else-if="toast.type === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      </div>
      <span class="toast-message">{{ toast.message }}</span>
      <button class="toast-close" @click.stop="remove(toast.id)" aria-label="Fechar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUIStore } from '@/stores/ui'

const ui = useUIStore()
const toasts = ui.toasts
const remove = ui.removeToast
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: var(--spacing-lg);
  right: var(--spacing-lg);
  z-index: 400;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  max-width: 360px;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  cursor: pointer;
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Toast persistente: não fecha no clique do corpo (permite selecionar/copiar),
   só fecha no botão X */
.toast.persistent { cursor: default; }
.toast.persistent .toast-message { user-select: text; cursor: text; }

.toast.success { border-left: 3px solid var(--accent-secondary); }
.toast.error { border-left: 3px solid var(--accent-danger); }
.toast.warning { border-left: 3px solid var(--accent-warning); }
.toast.info { border-left: 3px solid var(--accent-primary); }

.toast-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast.success .toast-icon { color: var(--accent-secondary); }
.toast.error .toast-icon { color: var(--accent-danger); }
.toast.warning .toast-icon { color: var(--accent-warning); }
.toast.info .toast-icon { color: var(--accent-primary); }

.toast-icon svg { width: 20px; height: 20px; }

.toast-message {
  flex: 1;
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--text-primary);
}

.toast-close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  padding: 0;
}

.toast-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toast-close svg { width: 16px; height: 16px; }
</style>