<template>
  <button
    v-if="variant === 'filter'"
    type="button"
    class="cat-chip cat-chip-filter"
    :class="{ ativo }"
    :style="filterStyle"
    :title="`Filtrar por ${meta.label}`"
    @click="emit('toggle', meta.id)"
  >
    <svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="meta.icon"></svg>
    <span class="cat-label">{{ label || meta.label }}</span>
    <span v-if="count !== undefined" class="cat-count">{{ count }}</span>
  </button>
  <span v-else class="cat-chip cat-chip-badge" :style="badgeStyle" :title="categoria || meta.label">
    <svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="meta.icon"></svg>
    <span class="cat-label">{{ label || meta.label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { matchCategoria, type CategoriaId } from '@/utils/chamadoIdentity'

const props = withDefaults(defineProps<{
  /** `tipo` livre do chamado OU um CategoriaId (REDE, EQUIPAMENTO, ...). */
  categoria: string | null | undefined
  /** 'filter' = botão clicável de filtro; 'badge' = etiqueta somente leitura. */
  variant?: 'filter' | 'badge'
  ativo?: boolean
  count?: number
  /** Sobrescreve o label exibido (padrão: label canônico da categoria). */
  label?: string
}>(), { variant: 'badge', ativo: false })

const emit = defineEmits<{ (e: 'toggle', id: CategoriaId): void }>()

const meta = computed(() => matchCategoria(props.categoria))

const badgeStyle = computed(() => ({
  color: meta.value.cor,
  background: `${meta.value.cor}1f`,
  borderColor: `${meta.value.cor}59`
}))

const filterStyle = computed(() => {
  if (!props.ativo) return {}
  return {
    color: '#0f172a',
    background: meta.value.cor,
    borderColor: meta.value.cor
  }
})
</script>

<style scoped>
.cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-color);
  font-size: var(--font-size-xs);
  font-weight: 600;
  white-space: nowrap;
}
.cat-icon { width: 14px; height: 14px; flex-shrink: 0; }
.cat-chip-filter {
  cursor: pointer;
  background: var(--bg-input);
  color: var(--text-secondary);
  padding: 6px 12px;
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
}
.cat-chip-filter:hover { border-color: currentColor; color: var(--text-primary); }
.cat-chip-filter.ativo { font-weight: 700; }
.cat-chip-filter.ativo:hover { color: #0f172a; filter: brightness(1.08); }
.cat-chip-filter .cat-count {
  background: rgba(0, 0, 0, 0.18);
  border-radius: var(--radius-full);
  padding: 1px 7px;
  font-size: 10px;
  font-family: var(--font-mono);
}
.cat-chip-filter:not(.ativo) .cat-count { background: var(--bg-tertiary); color: var(--text-muted); }
</style>
