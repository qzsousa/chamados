<template>
  <ol class="timeline" v-if="itens.length">
    <li v-for="(ev, i) in itens" :key="i" class="tl-item" :class="{ 'tl-mini': !ev.marco, 'tl-pendente': ev.estado === 'pendente' }">
      <span class="tl-node" :style="nodeStyle(ev)">
        <svg v-if="ev.icone === 'encaminhamento'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        <svg v-else-if="ev.estado === 'concluido'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </span>
      <div class="tl-content">
        <div class="tl-titulo">{{ ev.titulo }}</div>
        <div v-if="ev.detalhe" class="tl-detalhe">{{ ev.detalhe }}</div>
        <div class="tl-data">{{ ev.dataTexto }}</div>
      </div>
    </li>
  </ol>
  <p v-else class="tl-vazio">Sem histórico registrado.</p>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { parseHistorico, labelStatus, corStatus, type HistoricoEvento } from '@/utils/chamadoIdentity'

const props = defineProps<{
  /** Chamado com timestamp, tecnicoSetor, status e historico (texto livre). */
  chamado: any
}>()

interface TlItem {
  titulo: string
  detalhe?: string
  data: Date | null
  dataTexto: string
  estado: 'concluido' | 'pendente'
  marco: boolean
  icone: 'abertura' | 'encaminhamento' | 'status' | 'resolvido' | 'info'
}

function nodeStyle(ev: TlItem): Record<string, string> {
  if (!ev.marco) return {}
  if (ev.estado === 'pendente') {
    return { borderColor: 'var(--border-light)', color: 'var(--text-muted)', background: 'transparent' }
  }
  if (ev.icone === 'encaminhamento') {
    return { borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', background: 'rgba(59, 130, 246, 0.15)' }
  }
  return { borderColor: 'var(--status-resolvido)', color: 'var(--status-resolvido)', background: 'rgba(16, 185, 129, 0.15)' }
}

function fmt(d: Date): string {
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function dataTexto(ev: HistoricoEvento): string {
  if (ev.data) return fmt(ev.data)
  return ev.dataStr || 'data não registrada'
}

function buildItens(): TlItem[] {
  const c = props.chamado
  if (!c) return []

  const dataAbertura = new Date(c.timestamp)
  const abertura: TlItem = {
    titulo: 'Aberto pela escola',
    detalhe: c.unidade || undefined,
    data: dataAbertura,
    dataTexto: fmt(dataAbertura),
    estado: 'concluido',
    marco: true,
    icone: 'abertura'
  }

  // Encaminhamento é automático no ato da abertura (mapeamento escola → técnico).
  const encaminhamento: TlItem = c.tecnicoSetor
    ? { titulo: `Encaminhado para ${c.tecnicoSetor}`, data: dataAbertura, dataTexto: fmt(dataAbertura), estado: 'concluido', marco: true, icone: 'encaminhamento' }
    : { titulo: 'Aguardando encaminhamento ao técnico', data: null, dataTexto: '—', estado: 'pendente', marco: true, icone: 'encaminhamento' }

  const eventos = parseHistorico(c.historico)
  const datados: TlItem[] = []
  let comunicado: TlItem | null = null
  let resolvido: TlItem | null = null

  for (const ev of eventos) {
    if (ev.tipo === 'criacao') continue // redundante com o marco de abertura
    if (ev.tipo === 'status' && ev.statusNovo === 'COMUNICADO' && !comunicado) {
      comunicado = { titulo: 'Comunicado à unidade', detalhe: ev.autor, data: ev.data, dataTexto: dataTexto(ev), estado: 'concluido', marco: true, icone: 'status' }
      continue
    }
    if (ev.tipo === 'status' && ev.statusNovo === 'RESOLVIDO' && !resolvido) {
      resolvido = { titulo: 'Resolvido', detalhe: ev.autor, data: ev.data, dataTexto: dataTexto(ev), estado: 'concluido', marco: true, icone: 'resolvido' }
      continue
    }
    if (ev.tipo === 'status') {
      datados.push({
        titulo: `Status → ${labelStatus(ev.statusNovo)}`,
        detalhe: ev.autor,
        data: ev.data,
        dataTexto: dataTexto(ev),
        estado: 'concluido',
        marco: false,
        icone: 'status'
      })
      continue
    }
    datados.push({
      titulo: ev.tipo === 'resposta' ? (ev.autor ? `Resposta de ${ev.autor}` : 'Resposta') : 'Registro',
      detalhe: ev.texto,
      data: ev.data,
      dataTexto: dataTexto(ev),
      estado: 'concluido',
      marco: false,
      icone: 'info'
    })
  }

  // Status atual sem linha registrada (dados legados): marco concluído sem data.
  if (!comunicado && (c.status === 'COMUNICADO' || c.status === 'RESOLVIDO')) {
    comunicado = { titulo: 'Comunicado à unidade', data: null, dataTexto: 'data não registrada', estado: 'concluido', marco: true, icone: 'status' }
  }
  if (!resolvido && c.status === 'RESOLVIDO') {
    resolvido = { titulo: 'Resolvido', detalhe: c.tecnicoResolucao || undefined, data: null, dataTexto: 'data não registrada', estado: 'concluido', marco: true, icone: 'resolvido' }
  }

  const pendentes: TlItem[] = []
  if (!comunicado) pendentes.push({ titulo: 'Comunicado à unidade', data: null, dataTexto: 'Pendente', estado: 'pendente', marco: true, icone: 'status' })
  if (!resolvido) pendentes.push({ titulo: 'Resolvido', data: null, dataTexto: 'Pendente', estado: 'pendente', marco: true, icone: 'resolvido' })

  const marcosConcluidos = [comunicado, resolvido].filter((m): m is TlItem => !!m)
  const comData = [...datados, ...marcosConcluidos.filter((m) => m.data)]
  comData.sort((a, b) => (a.data?.getTime() || 0) - (b.data?.getTime() || 0))
  const semData = marcosConcluidos.filter((m) => !m.data)

  return [abertura, encaminhamento, ...comData, ...semData, ...pendentes]
}

const itens = computed(buildItens)
</script>

<style scoped>
.timeline { list-style: none; display: flex; flex-direction: column; }
.tl-item { display: flex; gap: 10px; position: relative; padding-bottom: 14px; }
.tl-item:last-child { padding-bottom: 0; }
/* linha vertical conectando os nós */
.tl-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 10px;
  top: 22px;
  bottom: 0;
  width: 2px;
  background: var(--border-color);
}
.tl-node {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-muted);
}
.tl-node svg { width: 12px; height: 12px; }
.tl-mini { padding-bottom: 10px; }
.tl-mini:not(:last-child)::before { top: 16px; }
.tl-mini .tl-node { width: 12px; height: 12px; margin: 4px 5px; border-width: 0; background: var(--border-light); }
.tl-content { min-width: 0; flex: 1; }
.tl-titulo { font-size: 12px; font-weight: 600; color: var(--text-primary); }
.tl-mini .tl-titulo { font-size: 11px; font-weight: 500; color: var(--text-secondary); }
.tl-detalhe { font-size: 11px; color: var(--text-muted); word-break: break-word; }
.tl-data { font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 1px; }
.tl-pendente .tl-titulo { color: var(--text-muted); font-weight: 500; }
.tl-vazio { font-size: 12px; color: var(--text-muted); }
</style>
