<template>
  <div class="detail-inline" v-if="chamado">
    <div class="detail-cols">
      <section class="detail-col">
        <h4 class="detail-col-title">Solicitante</h4>
        <div class="field"><span class="field-label">Nome</span><span class="field-value">{{ chamado.solicitante || '—' }}</span></div>
        <div class="field"><span class="field-label">Cargo</span><span class="field-value">{{ chamado.funcao || '—' }}</span></div>
        <div class="field">
          <span class="field-label">E-mail</span>
          <span class="field-value">
            <a v-if="chamado.email" :href="'mailto:' + chamado.email" class="email-link">{{ chamado.email }}</a>
            <template v-else>—</template>
          </span>
        </div>
        <div class="field">
          <span class="field-label">Contato da unidade</span>
          <span class="field-value contatos">
            <template v-if="(chamado.emailsContato || []).length">
              <a v-for="e in chamado.emailsContato" :key="e.email" :href="'mailto:' + e.email" class="email-link">{{ e.nome ? e.nome + ' — ' : '' }}{{ e.email }}</a>
            </template>
            <template v-else>— não informado —</template>
          </span>
        </div>
      </section>

      <section class="detail-col">
        <h4 class="detail-col-title">Problema</h4>
        <div class="field"><span class="field-label">Unidade</span><span class="field-value">{{ chamado.unidade }}</span></div>
        <div class="field">
          <span class="field-label">Categoria</span>
          <span class="field-value"><CategoryChip :categoria="chamado.tipo" :label="chamado.tipo" /></span>
        </div>
        <div class="field">
          <span class="field-label">Urgência</span>
          <span class="field-value"><span class="urgencia-badge" :class="classeUrgencia(chamado.urgencia)">{{ (chamado.urgencia || '').split(' ')[0] }}</span></span>
        </div>
        <div class="field"><span class="field-label">Técnico do setor</span><span class="field-value">{{ chamado.tecnicoSetor || '—' }}</span></div>
        <div class="field"><span class="field-label">Inventário</span><span class="field-value">{{ chamado.inventarioStatus || 'Não informado' }}</span></div>
        <div class="field"><span class="field-label">Aberto em</span><span class="field-value">{{ formatDate(chamado.timestamp) }}</span></div>
        <div class="field">
          <span class="field-label">Anexo</span>
          <span class="field-value">
            <a v-if="chamado.anexoUrl" :href="chamado.anexoUrl" target="_blank" rel="noopener" class="email-link">Ver anexo do chamado</a>
            <template v-else>— sem anexo —</template>
          </span>
        </div>
        <div class="field field-descricao">
          <span class="field-label">Descrição</span>
          <span class="field-value descricao">{{ chamado.descricao || '—' }}</span>
        </div>
        <div v-if="chamado.descricaoResolucao" class="field field-descricao">
          <span class="field-label">Descrição da resolução</span>
          <span class="field-value descricao">{{ chamado.descricaoResolucao }}</span>
        </div>
      </section>

      <section class="detail-col">
        <h4 class="detail-col-title">Andamento</h4>
        <StatusTimeline :chamado="chamado" />
      </section>
    </div>

    <div class="detail-actions" v-if="podeEditar">
      <label class="acao-field">
        <span class="acao-label">Situação</span>
        <select v-model="statusEdit" class="acao-select">
          <option v-for="s in STATUS_ORDEM" :key="s" :value="s">{{ STATUS_META[s].label }}</option>
        </select>
      </label>
      <label class="acao-field">
        <span class="acao-label">Responsável</span>
        <select v-model="responsavelEdit" class="acao-select">
          <option value="">— selecionar responsável —</option>
          <option v-for="r in RESPONSAVEIS" :key="r" :value="r">{{ r }}</option>
        </select>
      </label>
      <label class="acao-field acao-field-grow">
        <span class="acao-label">Descrição da resolução (enviada à escola por e-mail)</span>
        <textarea v-model="descricaoEdit" class="acao-textarea" rows="2" placeholder="Descreva o que foi feito para resolver o chamado..."></textarea>
      </label>
      <div class="acao-botoes">
        <Button variant="ghost" size="sm" @click="emit('copiar', chamado)" title="Copiar resumo do chamado">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copiar
        </Button>
        <Button variant="danger" size="sm" @click="emit('excluir', chamado)" title="Excluir chamado">Excluir</Button>
        <Button variant="primary" size="sm" :loading="salvando" :disabled="salvando" @click="emitSalvar" title="Salvar alterações">Salvar</Button>
      </div>
    </div>
    <div class="detail-actions" v-else>
      <Button variant="ghost" size="sm" @click="emit('copiar', chamado)" title="Copiar resumo do chamado">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copiar resumo
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import CategoryChip from './CategoryChip.vue'
import StatusTimeline from './StatusTimeline.vue'
import { RESPONSAVEIS, STATUS_META, STATUS_ORDEM } from '@/utils/chamadoIdentity'
import type { StatusChamado } from '../../../../shared/types/api'

const props = withDefaults(defineProps<{
  chamado: any
  podeEditar?: boolean
  salvando?: boolean
}>(), { podeEditar: false, salvando: false })

const emit = defineEmits<{
  (e: 'salvar', payload: { id: string; status: StatusChamado; descricaoResolucao?: string; responsavel?: string }): void
  (e: 'excluir', chamado: any): void
  (e: 'copiar', chamado: any): void
}>()

const statusEdit = ref<StatusChamado>('ABERTO')
const responsavelEdit = ref('')
const descricaoEdit = ref('')

watch(
  () => props.chamado?.id,
  () => {
    statusEdit.value = props.chamado?.status || 'ABERTO'
    responsavelEdit.value = props.chamado?.responsavel || ''
    descricaoEdit.value = props.chamado?.descricaoResolucao || ''
  },
  { immediate: true }
)

function emitSalvar() {
  if (!props.chamado) return
  emit('salvar', {
    id: props.chamado.id,
    status: statusEdit.value,
    descricaoResolucao: descricaoEdit.value || undefined,
    responsavel: responsavelEdit.value || undefined
  })
}

function classeUrgencia(u: string): string {
  if (!u) return 'urg-baixa'
  if (u.startsWith('Alta')) return 'urg-alta'
  if (u.startsWith('Média')) return 'urg-media'
  return 'urg-baixa'
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleString('pt-BR')
}
</script>

<style scoped>
.detail-inline {
  max-height: 420px;
  overflow-y: auto;
  padding: 16px 20px;
  background: var(--bg-input);
}
.detail-cols {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  gap: 20px;
}
@media (max-width: 1100px) {
  .detail-cols { grid-template-columns: 1fr; }
}
.detail-col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.detail-col-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 6px;
  margin-bottom: 2px;
}
.field { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.field-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
.field-value { font-size: 12px; color: var(--text-primary); word-break: break-word; }
.field-value.contatos { display: flex; flex-direction: column; gap: 2px; }
.field-value.descricao {
  white-space: pre-wrap;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  max-height: 140px;
  overflow-y: auto;
}
.email-link { color: var(--accent-primary); text-decoration: none; }
.email-link:hover { text-decoration: underline; }
.urgencia-badge { display: inline-block; padding: 2px 8px; border-radius: var(--radius-full); font-size: 10px; font-weight: 700; }
.urg-alta { background: rgba(239, 68, 68, 0.15); color: var(--accent-danger); }
.urg-media { background: rgba(245, 158, 11, 0.15); color: var(--accent-warning); }
.urg-baixa { background: rgba(16, 185, 129, 0.15); color: var(--accent-secondary); }

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}
.acao-field { display: flex; flex-direction: column; gap: 4px; min-width: 180px; }
.acao-field-grow { flex: 1; min-width: 240px; }
.acao-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
.acao-select { height: 34px; font-size: 12px; }
.acao-textarea { min-height: 50px; resize: vertical; font-size: 12px; }
.acao-botoes { display: flex; gap: 8px; align-items: center; margin-left: auto; }
</style>
