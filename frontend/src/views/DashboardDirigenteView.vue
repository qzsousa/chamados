<template>
  <div class="dirigente-page">
    <header class="topo">
      <div class="topo-inner">
        <div class="topo-marca">
          <img src="https://i.ibb.co/3yBdJq67/IMG-9095.png" alt="URE Leste 3" class="logo" />
          <div class="divisor"></div>
          <div>
            <p class="topo-eyebrow">Unidade Regional de Ensino — Leste 3</p>
            <h1 class="topo-titulo">Painel do Dirigente</h1>
          </div>
        </div>
        <div class="topo-acoes">
          <span v-if="atualizadoEm" class="ultima-sync">Atualizado às {{ atualizadoEm }}</span>
          <button class="btn-atualizar" @click="carregar" :disabled="carregando">
            <svg :class="{ girando: carregando }" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
            Atualizar
          </button>
        </div>
      </div>
    </header>

    <main class="conteudo">
      <div v-if="erro" class="aviso-erro">
        <p>{{ erro }}</p>
        <button class="btn-atualizar" @click="carregar">Tentar novamente</button>
      </div>

      <template v-else>
        <!-- KPIs -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-topo">
              <p class="kpi-label">Total de chamados</p>
              <div class="kpi-icone fundo-cinza"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/></svg></div>
            </div>
            <p class="kpi-valor">{{ kpis.total }}</p>
            <p class="kpi-sub">todos os registros</p>
          </div>

          <div class="kpi-card">
            <div class="kpi-topo">
              <p class="kpi-label">Aguardando atendimento</p>
              <div class="kpi-icone fundo-amarelo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
            </div>
            <p class="kpi-valor">{{ kpis.abertos }}</p>
            <p class="kpi-sub">chamados em aberto</p>
          </div>

          <div class="kpi-card">
            <div class="kpi-topo">
              <p class="kpi-label">Em atendimento</p>
              <div class="kpi-icone fundo-azul"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
            </div>
            <p class="kpi-valor">{{ emAtendimento }}</p>
            <p class="kpi-sub">andamento + comunicado</p>
          </div>

          <div class="kpi-card">
            <div class="kpi-topo">
              <p class="kpi-label">Taxa de resolução</p>
              <div class="kpi-icone fundo-verde"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg></div>
            </div>
            <p class="kpi-valor">{{ taxaResolucao }}<span class="kpi-pct">%</span></p>
            <p class="kpi-sub">{{ kpis.resolvidos }} chamados resolvidos</p>
          </div>
        </div>

        <!-- Linha 1: por tipo + situação geral -->
        <div class="grade-2-1">
          <div class="card">
            <h2 class="card-titulo">Chamados por categoria</h2>
            <p class="card-sub">Distribuição por categoria e situação</p>
            <div class="chart-area"><canvas ref="refTipo"></canvas></div>
          </div>
          <div class="card">
            <h2 class="card-titulo">Situação geral</h2>
            <p class="card-sub">Proporção por status</p>
            <div class="chart-area chart-area-alta"><canvas ref="refStatus"></canvas></div>
          </div>
        </div>

        <!-- Linha 2: por unidade + por técnico -->
        <div class="grade-1-1">
          <div class="card">
            <h2 class="card-titulo">Chamados por unidade</h2>
            <p class="card-sub">Top 8 unidades com mais chamados</p>
            <div class="chart-area"><canvas ref="refUnidade"></canvas></div>
          </div>
          <div class="card">
            <h2 class="card-titulo">Chamados por técnico</h2>
            <p class="card-sub">Distribuição de atendimentos</p>
            <div class="chart-area"><canvas ref="refTecnico"></canvas></div>
          </div>
        </div>

        <!-- Últimos chamados -->
        <div class="card">
          <h2 class="card-titulo">Últimos chamados recebidos</h2>
          <p class="card-sub">Os 5 chamados mais recentes</p>
          <div class="lista-recentes">
            <div v-for="c in ultimos" :key="c.id" class="item-recente">
              <div class="item-esquerda">
                <span class="item-protocolo">{{ c.protocolo }}</span>
                <span class="dot" :style="{ backgroundColor: corCategoria(c.tipo) }"></span>
                <div>
                  <p class="item-unidade">{{ c.unidade }}</p>
                  <p class="item-tipo">{{ c.tipo }}</p>
                </div>
              </div>
              <div class="item-direita">
                <span class="badge-status" :style="estiloStatus(c.status)">{{ rotuloStatus(c.status) }}</span>
                <span class="item-data">{{ formatarData(c.timestamp) }}</span>
              </div>
            </div>
            <p v-if="!ultimos.length && !carregando" class="vazio">Nenhum chamado registrado até o momento.</p>
          </div>
        </div>
      </template>
    </main>

    <footer class="rodape">
      Painel de acompanhamento — somente visualização &nbsp;·&nbsp; SCI Chamados · URE Leste 3 © {{ ano }}
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import api from '@/api/client'
import type { Chamado, DashboardMatrizResponse } from '../../../shared/types/api'

Chart.register(...registerables)

/* ---------------------------------- estado --------------------------------- */

const carregando = ref(false)
const erro = ref('')
const chamados = ref<Chamado[]>([])
const kpis = ref({ total: 0, abertos: 0, andamento: 0, comunicado: 0, resolvidos: 0, altaPrioridade: 0 })
const atualizadoEm = ref('')
const ano = new Date().getFullYear()

const refTipo = ref<HTMLCanvasElement | null>(null)
const refStatus = ref<HTMLCanvasElement | null>(null)
const refUnidade = ref<HTMLCanvasElement | null>(null)
const refTecnico = ref<HTMLCanvasElement | null>(null)

let chartTipo: Chart | null = null
let chartStatus: Chart | null = null
let chartUnidade: Chart | null = null
let chartTecnico: Chart | null = null
let autoRefresh: number | undefined

/* --------------------------------- cores ----------------------------------- */

const NAVY = '#13315c'

const CORES_STATUS: Record<string, string> = {
  ABERTO: '#eab308',
  ANDAMENTO: '#3b82f6',
  COMUNICADO: '#f59e0b',
  RESOLVIDO: '#10b981'
}

const ROTULOS_STATUS: Record<string, string> = {
  ABERTO: 'Em aberto',
  ANDAMENTO: 'Em andamento',
  COMUNICADO: 'Comunicado',
  RESOLVIDO: 'Resolvido'
}

const PALETA_CATEGORIA = ['#3b82f6', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#6366f1', '#eab308']

function corCategoria(tipo: string): string {
  if (!tipo) return '#6b7280'
  let h = 0
  for (let i = 0; i < tipo.length; i++) h = (h * 31 + tipo.charCodeAt(i)) >>> 0
  return PALETA_CATEGORIA[h % PALETA_CATEGORIA.length]
}

/* -------------------------------- derivados --------------------------------- */

const emAtendimento = computed(() => kpis.value.andamento + kpis.value.comunicado)

const taxaResolucao = computed(() =>
  kpis.value.total > 0 ? Math.round((kpis.value.resolvidos / kpis.value.total) * 100) : 0
)

const ultimos = computed(() =>
  [...chamados.value]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5)
)

function rotuloStatus(s: string): string {
  return ROTULOS_STATUS[s] || s
}

function estiloStatus(s: string) {
  const cor = CORES_STATUS[s] || '#64748b'
  return { backgroundColor: cor + '20', color: cor, borderColor: cor + '40' }
}

function formatarData(ts: string): string {
  const d = new Date(ts)
  const data = d.toLocaleDateString('pt-BR')
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${data} às ${hora}`
}

/* --------------------------------- gráficos --------------------------------- */

function opcoesBase() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#64748b', font: { family: 'Inter', size: 11 }, boxWidth: 10, boxHeight: 10, borderRadius: 3, useBorderRadius: true }
      },
      tooltip: {
        backgroundColor: NAVY,
        titleFont: { family: 'Inter', size: 12, weight: 600 as const },
        bodyFont: { family: 'Inter', size: 12 },
        padding: 10,
        cornerRadius: 8,
        displayColors: false
      }
    }
  }
}

function desenharGraficos() {
  const STATUS_ORDEM = ['ABERTO', 'ANDAMENTO', 'COMUNICADO', 'RESOLVIDO']

  /* ---- Chamados por categoria (barras empilhadas por status) ---- */
  const porTipo = new Map<string, Record<string, number>>()
  chamados.value.forEach(c => {
    const tipo = c.tipo || 'Outros'
    if (!porTipo.has(tipo)) porTipo.set(tipo, { ABERTO: 0, ANDAMENTO: 0, COMUNICADO: 0, RESOLVIDO: 0 })
    const linha = porTipo.get(tipo)!
    linha[c.status] = (linha[c.status] || 0) + 1
  })

  const tiposOrdenados = [...porTipo.entries()]
    .map(([nome, cont]) => ({ nome, cont, total: Object.values(cont).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  if (chartTipo) chartTipo.destroy()
  if (refTipo.value) {
    chartTipo = new Chart(refTipo.value, {
      type: 'bar',
      data: {
        labels: tiposOrdenados.map(t => t.nome),
        datasets: STATUS_ORDEM.map(s => ({
          label: ROTULOS_STATUS[s],
          data: tiposOrdenados.map(t => t.cont[s] || 0),
          backgroundColor: CORES_STATUS[s],
          borderRadius: 4,
          barPercentage: 0.55
        }))
      },
      options: {
        ...opcoesBase(),
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } },
          y: { stacked: true, beginAtZero: true, grid: { color: '#e2e8f0' }, ticks: { color: '#94a3b8', precision: 0, font: { family: 'Inter', size: 11 } } }
        }
      }
    })
  }

  /* ---- Situação geral (rosca) ---- */
  const contagemStatus = STATUS_ORDEM.map(s => chamados.value.filter(c => c.status === s).length)

  if (chartStatus) chartStatus.destroy()
  if (refStatus.value) {
    chartStatus = new Chart(refStatus.value, {
      type: 'doughnut',
      data: {
        labels: STATUS_ORDEM.map(s => ROTULOS_STATUS[s]),
        datasets: [{ data: contagemStatus, backgroundColor: STATUS_ORDEM.map(s => CORES_STATUS[s]), borderWidth: 2, borderColor: '#ffffff' }]
      },
      options: {
        ...opcoesBase(),
        cutout: '58%',
        plugins: {
          ...opcoesBase().plugins,
          legend: {
            ...opcoesBase().plugins.legend,
            position: 'right' as const
          }
        }
      }
    })
  }

  /* ---- Chamados por unidade (top 8, barras horizontais) ---- */
  const porUnidade = new Map<string, number>()
  chamados.value.forEach(c => porUnidade.set(c.unidade, (porUnidade.get(c.unidade) || 0) + 1))

  const unidadesTop = [...porUnidade.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([nome, total]) => ({ nome: nome.length > 28 ? nome.slice(0, 27) + '…' : nome, total }))

  if (chartUnidade) chartUnidade.destroy()
  if (refUnidade.value) {
    chartUnidade = new Chart(refUnidade.value, {
      type: 'bar',
      data: {
        labels: unidadesTop.map(u => u.nome),
        datasets: [{ data: unidadesTop.map(u => u.total), backgroundColor: NAVY, borderRadius: 4, barPercentage: 0.6 }]
      },
      options: {
        ...opcoesBase(),
        indexAxis: 'y',
        plugins: { ...opcoesBase().plugins, legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: '#e2e8f0' }, ticks: { color: '#94a3b8', precision: 0, font: { family: 'Inter', size: 11 } } },
          y: { grid: { display: false }, ticks: { color: '#475569', font: { family: 'Inter', size: 11 } } }
        }
      }
    })
  }

  /* ---- Chamados por técnico (barras horizontais) ---- */
  const porTecnico = new Map<string, number>()
  chamados.value.forEach(c => {
    const tec = c.tecnicoSetor || 'Não atribuído'
    porTecnico.set(tec, (porTecnico.get(tec) || 0) + 1)
  })

  const tecnicosOrd = [...porTecnico.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)

  if (chartTecnico) chartTecnico.destroy()
  if (refTecnico.value) {
    chartTecnico = new Chart(refTecnico.value, {
      type: 'bar',
      data: {
        labels: tecnicosOrd.map(([nome]) => nome),
        datasets: [{ data: tecnicosOrd.map(([, total]) => total), backgroundColor: '#3b82f6', borderRadius: 4, barPercentage: 0.6 }]
      },
      options: {
        ...opcoesBase(),
        indexAxis: 'y',
        plugins: { ...opcoesBase().plugins, legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: '#e2e8f0' }, ticks: { color: '#94a3b8', precision: 0, font: { family: 'Inter', size: 11 } } },
          y: { grid: { display: false }, ticks: { color: '#475569', font: { family: 'Inter', size: 11 } } }
        }
      }
    })
  }

  // Recalcula o layout dos gráficos quando a fonte Inter termina de carregar
  // (evita legendas medidas com a fonte de fallback)
  document.fonts?.ready.then(() => {
    [chartTipo, chartStatus, chartUnidade, chartTecnico].forEach(c => c?.resize())
  })
}

/* --------------------------------- carregar --------------------------------- */

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    const { data } = await api.get<DashboardMatrizResponse>('/dashboard/matriz')
    kpis.value = data.kpis
    chamados.value = data.chamados
    atualizadoEm.value = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    await nextTick()
    desenharGraficos()
  } catch {
    erro.value = 'Não foi possível carregar os dados do painel. Verifique sua conexão e tente novamente.'
  } finally {
    carregando.value = false
  }
}

onMounted(() => {
  carregar()
  autoRefresh = window.setInterval(carregar, 60_000)
})

onUnmounted(() => {
  if (autoRefresh) clearInterval(autoRefresh)
  ;[chartTipo, chartStatus, chartUnidade, chartTecnico].forEach(c => c?.destroy())
})
</script>

<style scoped>
.dirigente-page { min-height: 100vh; background: #f1f5f9; color: #334155; display: flex; flex-direction: column; }

/* ---------- header ---------- */
.topo { background: #fff; border-bottom: 1px solid #e2e8f0; }
.topo-inner { max-width: 1200px; margin: 0 auto; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.topo-marca { display: flex; align-items: center; gap: 16px; min-width: 0; }
.logo { width: 44px; height: 44px; object-fit: contain; border-radius: 8px; flex-shrink: 0; }
.divisor { width: 1px; height: 40px; background: #e2e8f0; flex-shrink: 0; }
.topo-eyebrow { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #13315c; margin: 0; }
.topo-titulo { font-size: 20px; font-weight: 800; color: #13315c; margin: 0; }
.topo-acoes { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.ultima-sync { font-size: 11px; color: #94a3b8; }
.btn-atualizar { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #64748b; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 14px; cursor: pointer; transition: all 0.15s; }
.btn-atualizar:hover { color: #13315c; border-color: #cbd5e1; }
.btn-atualizar:disabled { opacity: 0.6; cursor: wait; }
.girando { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }

/* ---------- conteúdo ---------- */
.conteudo { flex: 1; width: 100%; max-width: 1200px; margin: 0 auto; padding: 32px 24px; display: flex; flex-direction: column; gap: 24px; }

.aviso-erro { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 16px; padding: 32px; text-align: center; font-size: 14px; display: flex; flex-direction: column; align-items: center; gap: 12px; }

/* ---------- KPIs ---------- */
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
@media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .kpi-grid { grid-template-columns: 1fr; } }

.kpi-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); transition: box-shadow 0.15s; }
.kpi-card:hover { box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); }
.kpi-topo { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
.kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin: 0; }
.kpi-icone { width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.fundo-cinza { background: #f1f5f9; color: #475569; }
.fundo-amarelo { background: #fefce8; color: #ca8a04; }
.fundo-azul { background: #eff6ff; color: #2563eb; }
.fundo-verde { background: #ecfdf5; color: #059669; }
.kpi-valor { font-size: 36px; font-weight: 800; color: #13315c; line-height: 1.1; margin: 0 0 4px; font-variant-numeric: tabular-nums; }
.kpi-pct { font-size: 20px; font-weight: 700; margin-left: 2px; }
.kpi-sub { font-size: 12px; color: #94a3b8; margin: 0; }

/* ---------- cards / grades ---------- */
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); min-width: 0; }
.card-titulo { font-size: 14px; font-weight: 700; color: #334155; margin: 0 0 2px; }
.card-sub { font-size: 12px; color: #94a3b8; margin: 0 0 20px; }

.grade-2-1 { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
.grade-1-1 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media (max-width: 900px) { .grade-2-1, .grade-1-1 { grid-template-columns: 1fr; } }

.chart-area { position: relative; height: 240px; min-width: 0; }
.chart-area-alta { height: 280px; }

/* ---------- últimos chamados ---------- */
.lista-recentes { display: flex; flex-direction: column; gap: 10px; }
.item-recente { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; background: #f8fafc; border-radius: 12px; }
.item-esquerda { display: flex; align-items: center; gap: 12px; min-width: 0; }
.item-protocolo { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; color: #94a3b8; flex-shrink: 0; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.item-unidade { font-size: 13px; font-weight: 600; color: #334155; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-tipo { font-size: 11px; color: #94a3b8; margin: 0; }
.item-direita { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.badge-status { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 8px; border: 1px solid; white-space: nowrap; }
.item-data { font-size: 11px; color: #94a3b8; white-space: nowrap; }
.vazio { text-align: center; color: #94a3b8; font-size: 13px; padding: 24px 0; margin: 0; }

@media (max-width: 640px) {
  .item-recente { flex-direction: column; align-items: flex-start; }
  .item-direita { width: 100%; justify-content: space-between; }
  .topo-inner { flex-direction: column; align-items: flex-start; }
}

/* ---------- rodapé ---------- */
.rodape { background: #13315c; color: #93b4d8; text-align: center; font-size: 12px; padding: 16px 24px; }
</style>
