<template>
  <div class="dashboard-matriz">
    <header class="header">
      <div class="header-left">
        <a href="https://www.educacao.sp.gov.br/ureleste3" target="_blank" rel="noopener" class="logo">
          <img src="https://i.ibb.co/3yBdJq67/IMG-9095.png" alt="Logo URE Leste 3" class="logo-img" />
          <span>Sistema de Chamados</span>
        </a>
      </div>
      <div class="header-center"><div class="clock" id="clock">--:--:--</div></div>
      <div class="header-right">
        <button v-if="auth.isAdmin" class="btn-gerenciar" @click="router.push('/admin/usuarios')" title="Gerenciar usuários"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Usuários</button>
        <label class="theme-toggle" title="Alternar tema"><input type="checkbox" id="theme-toggle" v-model="darkMode"><span class="slider"><svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg><svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span></label>
      </div>
    </header>

    <aside class="sidebar-left" :class="{ open: sidebarLeftOpen }">
      <section class="sidebar-section"><h2 class="sidebar-section-title"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>Filtros</h2>
        <div class="filter-group"><label class="filter-label" for="filter-protocolo">Protocolo</label><input type="text" class="filter-input" id="filter-protocolo" placeholder="Buscar protocolo..." v-model="filtros.protocolo"></div>
        <div class="filter-group"><label class="filter-label" for="filter-unidade">Unidade</label><select class="filter-select" id="filter-unidade" v-model="filtros.unidade"><option value="">Todas as unidades</option><option v-for="u in unidadesUnicas" :key="u" :value="u">{{ u }}</option></select></div>
        <div class="filter-group"><label class="filter-label" for="filter-categoria">Categoria</label><select class="filter-select" id="filter-categoria" v-model="filtros.categoria"><option value="">Todas as categorias</option><option v-for="c in categoriasUnicas" :key="c" :value="c">{{ c }}</option></select></div>
        <div class="filter-group"><label class="filter-label" for="filter-status">Status</label><select class="filter-select" id="filter-status" v-model="filtros.status"><option value="">Todos os status</option><option value="ABERTO">Aberto</option><option value="ANDAMENTO">Em andamento</option><option value="COMUNICADO">Comunicado</option><option value="RESOLVIDO">Resolvido</option></select></div>
        <div class="filter-group"><label class="filter-label" for="filter-urgency">Urgência</label><select class="filter-select" id="filter-urgency" v-model="filtros.urgencia"><option value="">Todas as urgências</option><option value="Alta">Alta</option><option value="Média">Média</option><option value="Baixa">Baixa</option></select></div>
        <div class="filter-group"><label class="filter-label" for="filter-tecnico">Técnico</label><select class="filter-select" id="filter-tecnico" v-model="filtros.tecnico"><option value="">Todos os técnicos</option><option v-for="t in tecnicosUnicos" :key="t" :value="t">{{ t }}</option></select></div>
      </section>
    </aside>

    <main class="main">
      <div class="toolbar">
        <div class="chips-container">
          <span v-if="filtros.protocolo" class="chip">Protocolo: {{ filtros.protocolo }}<button class="remove-btn" @click="filtros.protocolo=''">×</button></span>
          <span v-if="filtros.unidade" class="chip chip-unit">Unidade: {{ filtros.unidade }}<button class="remove-btn" @click="filtros.unidade=''">×</button></span>
          <span v-if="filtros.categoria" class="chip chip-category">Categoria: {{ filtros.categoria }}<button class="remove-btn" @click="filtros.categoria=''">×</button></span>
          <span v-if="filtros.status" class="chip chip-status">Status: {{ filtros.status }}<button class="remove-btn" @click="filtros.status=''">×</button></span>
          <span v-if="filtros.urgencia" class="chip chip-priority">Urgência: {{ filtros.urgencia }}<button class="remove-btn" @click="filtros.urgencia=''">×</button></span>
          <span v-if="filtros.tecnico" class="chip chip-technician">Técnico: {{ filtros.tecnico }}<button class="remove-btn" @click="filtros.tecnico=''">×</button></span>
        </div>
      </div>

      <div class="tabs">
        <button class="tab-btn" :class="{ active: activeTab === 'tabela' }" @click="activeTab='tabela'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>Tabela</button>
        <button class="tab-btn" :class="{ active: activeTab === 'kanban' }" @click="activeTab='kanban'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="5" height="14" rx="1"/><rect x="10" y="3" width="5" height="10" rx="1"/><rect x="17" y="3" width="5" height="16" rx="1"/></svg>Kanban</button>
        <button class="tab-btn" :class="{ active: activeTab === 'agrupado' }" @click="activeTab='agrupado'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>Agrupado</button>
        <button class="tab-btn" :class="{ active: activeTab === 'graficos' }" @click="activeTab='graficos'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Gráficos</button>
      </div>

      <div class="tab-content">
        <div class="tab-panel" :class="{ active: activeTab === 'tabela' }">
          <div class="kpi-grid">
            <div class="kpi-card abertos"><div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg></div><div class="kpi-content"><div class="kpi-label">Abertos</div><div class="kpi-value">{{ stats.abertos }}</div></div></div>
            <div class="kpi-card andamento"><div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg></div><div class="kpi-content"><div class="kpi-label">Em andamento</div><div class="kpi-value">{{ stats.andamento }}</div></div></div>
            <div class="kpi-card comunicado"><div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div><div class="kpi-content"><div class="kpi-label">Comunicado</div><div class="kpi-value">{{ stats.comunicado }}</div></div></div>
            <div class="kpi-card resolvidos"><div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div><div class="kpi-content"><div class="kpi-label">Resolvidos</div><div class="kpi-value">{{ stats.resolvidos }}</div></div></div>
          </div>

          <div class="filter-bar">
        <span class="filter-bar-title">Filtros</span>
        <select v-model="filtros.unidade"><option value="">Todas as unidades</option><option v-for="u in unidadesUnicas" :key="u" :value="u">{{ u }}</option></select>
        <select v-model="filtros.categoria"><option value="">Todas as categorias</option><option v-for="c in categoriasUnicas" :key="c" :value="c">{{ c }}</option></select>
        <select v-model="filtros.status"><option value="">Todos os status</option><option value="ABERTO">Aberto</option><option value="ANDAMENTO">Em andamento</option><option value="COMUNICADO">Comunicado</option><option value="RESOLVIDO">Resolvido</option></select>
        <select v-model="filtros.urgencia"><option value="">Todas as urgências</option><option value="Alta">Alta</option><option value="Média">Média</option><option value="Baixa">Baixa</option></select>
        <select v-model="filtros.tecnico"><option value="">Todos os técnicos</option><option v-for="t in tecnicosUnicos" :key="t" :value="t">{{ t }}</option></select>
      </div>

          <div class="table-container">
            <div class="table-wrapper">
              <table class="table">
                <thead><tr><th>Protocolo</th><th>Urgência</th><th>Unidade</th><th>Categoria</th><th>Descrição</th><th>Técnico</th><th>Inventário</th><th>Status</th><th>Aberto</th></tr></thead>
                <tbody>
                  <tr v-for="c in chamadosFiltrados" :key="c.id" @click="abrirModal(c)" class="linha-chamado">
                    <td class="cell-protocolo">{{ c.protocolo }}</td>
                    <td><span class="cell-urgency" :class="classeUrgencia(c.urgencia)">{{ c.urgencia.split(' ')[0] }}</span></td>
                    <td>{{ truncar(c.unidade, 30) }}</td>
                    <td><span class="categoria" :style="{ background: corCategoria(c.tipo), color: '#fff', borderColor: corCategoria(c.tipo) }">{{ truncar(c.tipo, 18) }}</span></td>
                    <td>{{ truncar(c.descricao || '', 50) }}</td>
                    <td class="text-center">{{ c.tecnicoSetor || '—' }}</td>
                    <td class="text-center"><span class="inventario-badge" :class="classeInventario(c.inventarioStatus)">{{ c.inventarioStatus || '—' }}</span></td>
                    <td class="text-center"><span class="status-badge" :class="classeStatus(c.status)">{{ c.status }}</span></td>
                    <td class="text-right" :class="{ critico: isCritico(c) }">{{ tempoDecorrido(c.timestamp) }}</td>
                  </tr>
                  <tr v-if="chamadosFiltrados.length === 0"><td colspan="9" class="text-center" style="padding: 48px 20px; color: var(--text-muted);">Nenhum chamado encontrado</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="tab-panel" :class="{ active: activeTab === 'kanban' }">
          <div class="kanban-board">
            <div class="kanban-column" v-for="col in kanbanColumns" :key="col.status">
              <div class="kanban-column-header"><div class="kanban-column-title"><span class="status-dot" :class="col.color"></span>{{ col.label }}<span class="kanban-column-count">{{ getChamadosByStatus(col.status).length }}</span></div></div>
              <div class="kanban-cards">
                <div class="kanban-card" v-for="c in getChamadosByStatus(col.status)" :key="c.id" @click="abrirModal(c)">
                  <div class="kanban-card-header"><span class="kanban-card-protocolo">{{ c.protocolo }}</span><span class="kanban-card-urgency" :class="classeUrgencia(c.urgencia)">{{ c.urgencia.split(' ')[0] }}</span></div>
                  <div class="kanban-card-body">{{ c.unidade }} · {{ truncar(c.tipo, 20) }}</div>
                  <div class="kanban-card-footer"><span>{{ tempoDecorrido(c.timestamp) }}</span><span class="status-badge" :class="classeStatus(c.status)">{{ c.status }}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="tab-panel" :class="{ active: activeTab === 'agrupado' }">
          <div class="grouped-view">
            <div class="group-category" v-for="cat in categoriasAgrupadas" :key="cat.tipo" :class="{ expanded: cat.expanded }">
              <div class="group-category-header" @click="cat.expanded = !cat.expanded">
                <div class="group-category-title">{{ cat.tipo }}<span class="group-category-count">{{ cat.items.length }}</span></div>
                <svg class="group-category-toggle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              <div class="group-category-content">
                <div class="group-unit" v-for="unit in cat.unidades" :key="unit.nome">
                  <div class="group-unit-header">{{ unit.nome }}<span class="group-unit-count">{{ unit.items.length }}</span></div>
                  <div class="group-tickets">
                    <div class="group-ticket" v-for="c in unit.items" :key="c.id" @click="abrirModal(c)">
                      <span class="group-ticket-protocolo">{{ c.protocolo }}</span>
                      <span class="status-badge" :class="classeStatus(c.status)">{{ c.status }}</span>
                      <span class="group-ticket-title">{{ truncar(c.descricao || '', 40) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="tab-panel" :class="{ active: activeTab === 'graficos' }">
          <div class="charts-grid">
            <div class="charts-left">
              <div class="chart-box"><div class="chart-title">Por Status</div><canvas id="chartStatus"></canvas></div>
              <div class="chart-box"><div class="chart-title">Por Urgência</div><canvas id="chartUrgencia"></canvas></div>
            </div>
            <div class="chart-box"><div class="chart-title">Resolvidos por Técnico</div><canvas id="chartTecnico"></canvas></div>
          </div>
        </div>
      </div>

      <div class="modal-overlay" :class="{ open: modalAberto }" @click.self="fecharModal">
        <div class="modal" v-if="chamadoAtual">
          <div class="modal-header">
            <div class="modal-title-wrap"><h2 class="modal-title">{{ chamadoAtual.protocolo }}<Button variant="ghost" size="sm" @click="copiarChamado" class="btn-copiar" title="Copiar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></Button></h2></div>
            <div class="modal-header-actions">
              <button v-if="podeResolver" class="btn-atualizar-status" @click="abrirModalStatus">Atualizar status do chamado</button>
              <Button variant="ghost" size="sm" @click="fecharModal" class="modal-close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></Button>
            </div>
          </div>
          <div class="modal-body">
            <div class="detail-grid">
              <div class="detail-field"><div class="detail-label">Unidade</div><div class="detail-value">{{ chamadoAtual.unidade }}</div></div>
              <div class="detail-field"><div class="detail-label">Solicitante</div><div class="detail-value">{{ chamadoAtual.solicitante }}</div></div>
              <div class="detail-field"><div class="detail-label">Função</div><div class="detail-value">{{ chamadoAtual.funcao || '—' }}</div></div>
              <div class="detail-field"><div class="detail-label">Tipo</div><div class="detail-value">{{ chamadoAtual.tipo }}</div></div>
              <div class="detail-field"><div class="detail-label">Urgência</div><div class="detail-value"><span class="detail-badge" :class="classeUrgenciaBadge(chamadoAtual.urgencia)">{{ chamadoAtual.urgencia.split(' ')[0] }}</span></div></div>
              <div class="detail-field"><div class="detail-label">Técnico do Setor</div><div class="detail-value">{{ chamadoAtual.tecnicoSetor || '—' }}</div></div>
              <div class="detail-field"><div class="detail-label">Inventário</div><div class="detail-value"><span class="detail-badge" :class="classeInventarioBadge(chamadoAtual.inventarioStatus)">{{ chamadoAtual.inventarioStatus || 'Não informado' }}</span></div></div>
              <div class="detail-field"><div class="detail-label">Aberto em</div><div class="detail-value">{{ formatDate(chamadoAtual.timestamp) }}</div></div>
              <div class="detail-field full-width"><div class="detail-label">E-mail(s) para contato</div><div class="detail-value long-text"><template v-if="(chamadoAtual.emailsContato || []).length"><div v-for="e in chamadoAtual.emailsContato" :key="e.email"><a :href="'mailto:' + e.email" class="email-link">{{ e.nome ? e.nome + ' — ' : '' }}{{ e.email }}</a></div></template><span v-else>— não informado —</span></div></div>
              <div class="detail-field full-width"><div class="detail-label">Descrição</div><div class="detail-value long-text">{{ chamadoAtual.descricao || '—' }}</div></div>
              <div class="detail-field full-width"><div class="detail-label">Anexo</div><div class="detail-value long-text"><a v-if="chamadoAtual.anexoUrl" :href="chamadoAtual.anexoUrl" target="_blank" rel="noopener" class="email-link">Ver anexo do chamado</a><span v-else>— sem anexo —</span></div></div>
              <div v-if="chamadoAtual.descricaoResolucao" class="detail-field full-width"><div class="detail-label">Descrição da resolução</div><div class="detail-value long-text">{{ chamadoAtual.descricaoResolucao }}</div></div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-overlay" :class="{ open: modalStatusAberto }" @click.self="fecharModalStatus">
        <div class="modal modal-status" v-if="chamadoAtual">
          <div class="modal-header">
            <div class="modal-title-wrap"><h2 class="modal-title">Atualizar status — {{ chamadoAtual.protocolo }}</h2></div>
            <Button variant="ghost" size="sm" @click="fecharModalStatus" class="modal-close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></Button>
          </div>
          <div class="modal-body">
            <div class="resolver-box">
              <label class="resolver-label">Novo status</label>
              <select v-model="novoStatus" class="status-select-modal"><option value="ABERTO">Aberto</option><option value="ANDAMENTO">Em andamento</option><option value="COMUNICADO">Comunicado</option><option value="RESOLVIDO">Resolvido</option></select>
              <label class="resolver-label">Responsável pelo atendimento</label>
              <select v-model="responsavel" class="status-select-modal"><option value="">— selecionar responsável —</option><option v-for="r in RESPONSAVEIS" :key="r" :value="r">{{ r }}</option></select>
              <label class="resolver-label">Descrição da resolução (enviada à escola por e-mail)</label>
              <textarea v-model="descricaoResolucao" class="resolver-textarea" placeholder="Descreva o que foi feito para resolver o chamado..."></textarea>
              <div class="modal-actions-resolver">
                <Button variant="secondary" @click="fecharModalStatus">Cancelar</Button>
                <Button variant="primary" @click="salvarStatus">Salvar status</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useChamadosStore } from '@/stores/chamados'
import { useAuthStore } from '@/stores/auth'
import { Chart, registerables } from 'chart.js'
import Button from '@/components/ui/Button.vue'

Chart.register(...registerables)

const router = useRouter()
const chamados = useChamadosStore()
const auth = useAuthStore()

const podeResolver = computed(() => auth.isAuthenticated && ['ADMIN', 'TECNICO', 'GESTOR'].includes(auth.user?.nivel || ''))

const darkMode = ref(true)
const sidebarLeftOpen = ref(false)
const activeTab = ref<'tabela'|'kanban'|'agrupado'|'graficos'>('tabela')
const modalAberto = ref(false)
const chamadoAtual = ref<any>(null)
const novoStatus = ref('RESOLVIDO')
const descricaoResolucao = ref('')
const modalStatusAberto = ref(false)
const responsavel = ref('')

const RESPONSAVEIS = ['JOÃO','CHARLES','HERBERT','JOSEMIR','CAROL','GUILHERME','VALDEIR','JESSICA','MATHEUS','FABIO','PABLO','FERNANDA']

const filtros = reactive({protocolo:'',unidade:'',categoria:'',status:'',urgencia:'',tecnico:'',dataDe:'',dataAte:''})

const stats = reactive({abertos:0,andamento:0,comunicado:0,resolvidos:0})

const kanbanColumns = [
  {status:'ABERTO',label:'Abertos',color:'status-abertos'},
  {status:'ANDAMENTO',label:'Em andamento',color:'status-andamento'},
  {status:'COMUNICADO',label:'Comunicado',color:'status-comunicado'},
  {status:'RESOLVIDO',label:'Resolvidos',color:'status-resolvidos'}
]

let statusChart: Chart | null = null
let urgenciaChart: Chart | null = null
let tecnicoChart: Chart | null = null

onMounted(async()=>{
  await chamados.carregarMatriz()
  updateStats()
  updateDerived()
})

watch(()=>chamados.lista,()=>{updateStats();updateDerived();if(activeTab.value==='graficos')drawCharts()},{deep:true})

watch(activeTab, async (t)=>{ if(t==='graficos'){ await nextTick(); drawCharts() } })

function updateStats(){stats.abertos=chamados.stats.abertos;stats.andamento=chamados.stats.andamento;stats.comunicado=chamados.stats.comunicado;stats.resolvidos=chamados.stats.resolvidos}

const unidadesUnicas=computed(()=>[...new Set(chamados.lista.map(c=>c.unidade))].sort())
const categoriasUnicas=computed(()=>[...new Set(chamados.lista.map(c=>c.tipo))].sort())
const tecnicosUnicos=computed(()=>[...new Set(chamados.lista.map(c=>c.tecnicoSetor).filter(Boolean))].sort())

const chamadosFiltrados=computed(()=>{
  let result=chamados.lista
  if(filtros.protocolo)result=result.filter(c=>c.protocolo.includes(filtros.protocolo))
  if(filtros.unidade)result=result.filter(c=>c.unidade===filtros.unidade)
  if(filtros.categoria)result=result.filter(c=>c.tipo===filtros.categoria)
  if(filtros.status)result=result.filter(c=>c.status===filtros.status)
  if(filtros.urgencia)result=result.filter(c=>c.urgencia.startsWith(filtros.urgencia))
  if(filtros.tecnico)result=result.filter(c=>c.tecnicoSetor===filtros.tecnico)
  return result.sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())
})

function getChamadosByStatus(status:string){return chamadosFiltrados.value.filter(c=>c.status===status)}

const categoriasAgrupadas=computed(()=>{
  const map=new Map<string,{tipo:string,items:any[],unidades:Map<string,any[]>}>()
  chamadosFiltrados.value.forEach(c=>{
    const tipo=c.tipo||'Sem categoria'
    if(!map.has(tipo))map.set(tipo,{tipo,items:[],unidades:new Map()})
    const g=map.get(tipo)!
    g.items.push(c)
    const un=c.unidade||'Sem unidade'
    if(!g.unidades.has(un))g.unidades.set(un,{nome:un,items:[]})
    g.unidades.get(un)!.items.push(c)
  })
  return Array.from(map.values()).map(g=>({...g,expanded:true,unidades:Array.from(g.unidades.values()).sort((a,b)=>b.items.length-a.items.length)}))
})

function updateDerived(){}

function abrirModal(c:any){chamadoAtual.value=c;novoStatus.value=c.status||'RESOLVIDO';descricaoResolucao.value=c.descricaoResolucao||'';responsavel.value=c.responsavel||'';modalAberto.value=true}
function fecharModal(){modalAberto.value=false;chamadoAtual.value=null;descricaoResolucao.value='';responsavel.value=''}

function abrirModalStatus(){
  novoStatus.value = chamadoAtual.value?.status || 'RESOLVIDO'
  descricaoResolucao.value = chamadoAtual.value?.descricaoResolucao || ''
  responsavel.value = chamadoAtual.value?.responsavel || ''
  modalStatusAberto.value = true
}
function fecharModalStatus(){modalStatusAberto.value=false}

async function salvarStatus(){
  if(!chamadoAtual.value)return
  await chamados.atualizarStatus(chamadoAtual.value.id, { status: novoStatus.value, descricaoResolucao: descricaoResolucao.value || undefined, responsavel: responsavel.value || undefined })
  fecharModalStatus()
  modalAberto.value = false
  chamadoAtual.value = null
  descricaoResolucao.value = ''
  responsavel.value = ''
  await chamados.carregarMatriz()
}

function copiarChamado(){if(!chamadoAtual.value)return;const d=chamadoAtual.value;const txt=`PROTOCOLO: ${d.protocolo}\nUNIDADE: ${d.unidade}\nSOLICITANTE: ${d.solicitante}\nCARGO: ${d.funcao||'—'}\nTIPO: ${d.tipo}\nURGÊNCIA: ${d.urgencia}\nSTATUS: ${d.status}\nTÉCNICO: ${d.tecnicoSetor||'—'}\nINVENTÁRIO: ${d.inventarioStatus||'—'}\nABERTO: ${formatDate(d.timestamp)}\nDESCRIÇÃO:\n${d.descricao||'—'}`;navigator.clipboard.writeText(txt)}

function classeUrgencia(u:string){if(u.startsWith('Alta'))return'urgency-critica';if(u.startsWith('Média'))return'urgency-media';return'urgency-baixa'}
function classeUrgenciaBadge(u:string){if(u.startsWith('Alta'))return'urg-pill-alta';if(u.startsWith('Média'))return'urg-pill-media';return'urg-pill-baixa'}
function classeStatus(s:string){if(s==='ABERTO')return'status-abertos';if(s==='ANDAMENTO')return'status-andamento';if(s==='COMUNICADO')return'status-comunicado';return'status-resolvidos'}
function classeInventario(i:string|undefined){if(i==='CONCLUIDO')return'inventario-concluido';if(i==='EM_ANDAMENTO')return'inventario-andamento';if(i==='NAO_REALIZADO')return'inventario-nao-realizado';return'inventario-nao-informado'}
function classeInventarioBadge(i:string|undefined){if(i==='CONCLUIDO')return'inventario-concluido';if(i==='EM_ANDAMENTO')return'inventario-andamento';if(i==='NAO_REALIZADO')return'inventario-nao-realizado';return'inventario-nao-informado'}

const CORES_CATEGORIA = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316','#14b8a6','#6366f1','#eab308']
function corCategoria(tipo:string){
  if(!tipo)return'#6b7280'
  let h=0
  for(let i=0;i<tipo.length;i++)h=(h*31+tipo.charCodeAt(i))>>>0
  return CORES_CATEGORIA[h%CORES_CATEGORIA.length]
}

function truncar(t:string,max:number){return t.length>max?t.slice(0,max-1)+'…':t}
function tempoDecorrido(ts:string){const ms=Date.now()-new Date(ts).getTime();const h=ms/3600000;if(h<1)return Math.round(ms/60000)+' min';if(h<24)return Math.round(h)+'h';return Math.round(h/24)+'d'}
function isCritico(c:any){const ms=Date.now()-new Date(c.timestamp).getTime();return ms/3600000>4&&c.status!=='RESOLVIDO'}
function formatDate(ts:string){return new Date(ts).toLocaleString('pt-BR')}

function drawCharts(){
  const opts={responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'var(--text-secondary)',font:{family:'Inter',size:11}}}},scales:{x:{grid:{color:'transparent'}},y:{grid:{color:'var(--border-color)'}}}}
  if(statusChart)statusChart.destroy()
  const statusCount:Record<string,number>={}
  chamados.lista.forEach(c=>{statusCount[c.status]=(statusCount[c.status]||0)+1})
  statusChart=new Chart(document.getElementById('chartStatus') as HTMLCanvasElement,{type:'doughnut',data:{labels:Object.keys(statusCount),datasets:[{data:Object.values(statusCount),backgroundColor:['#f1c40f','#3b82f6','#f59e0b','#10b981'],borderWidth:0}]},options:{...opts,cutout:'55%'}})

  if(urgenciaChart)urgenciaChart.destroy()
  const urgCount:Record<string,number>={}
  chamados.lista.forEach(c=>{const u=c.urgencia.split(' ')[0];urgCount[u]=(urgCount[u]||0)+1})
  urgenciaChart=new Chart(document.getElementById('chartUrgencia') as HTMLCanvasElement,{type:'doughnut',data:{labels:Object.keys(urgCount),datasets:[{data:Object.values(urgCount),backgroundColor:['#ef4444','#f59e0b','#10b981'],borderWidth:0}]},options:{...opts,cutout:'55%'}})

  if(tecnicoChart)tecnicoChart.destroy()
  const tecnicos=['CAROL','CHARLES','FABIO','GUILHERME','HEBERT','JOSEMIR','JOÃO','VALDEIR']
  const tecCount:Record<string,number>={}
  tecnicos.forEach(t=>tecCount[t]=0)
  chamados.lista.filter(c=>c.status==='RESOLVIDO'&&c.tecnicoResolucao).forEach(c=>{if(tecCount[c.tecnicoResolucao]!==undefined)tecCount[c.tecnicoResolucao]++})
  tecnicoChart=new Chart(document.getElementById('chartTecnico') as HTMLCanvasElement,{type:'bar',data:{labels:tecnicos,datasets:[{label:'Resolvidos',data:tecnicos.map(t=>tecCount[t]),backgroundColor:'#10b981',borderRadius:4}]},options:{...opts,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{grid:{color:'var(--border-color)'},beginAtZero:true},y:{grid:{color:'transparent'}}}}})
}

let clockInterval: number

function clock() {
  const el = document.getElementById('clock')
  if (el) el.textContent = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
}

onMounted(() => {
  clock()
  clockInterval = window.setInterval(clock, 1000)

  const themeToggle = document.getElementById('theme-toggle') as HTMLInputElement
  if (themeToggle) {
    themeToggle.checked = darkMode.value
    themeToggle.addEventListener('change', (e) => {
      darkMode.value = (e.target as HTMLInputElement).checked
      document.body.classList.toggle('light', !darkMode.value)
    })
  }
})

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
})
</script>

<style scoped>
.dashboard-matriz{display:flex;flex-direction:column;min-height:100vh;background:var(--bg-primary)}
.header{display:flex;align-items:center;justify-content:space-between;height:64px;padding:0 24px;background:var(--bg-secondary);border-bottom:1px solid var(--border-color);z-index:100}
.header-left{flex:1}.header-center{flex:1;justify-content:center;display:flex}.header-right{flex:1;justify-content:flex-end;display:flex;gap:12px}
.logo{display:flex;align-items:center;gap:12px;font-weight:700;font-size:20px;color:var(--text-primary);text-decoration:none}.logo-img{width:40px;height:40px;object-fit:contain;border-radius:6px}
.clock{font-family:var(--font-mono);font-size:16px;font-variant-numeric:tabular-nums;color:var(--text-secondary);background:var(--bg-tertiary);padding:4px 16px;border-radius:999px;min-width:140px;text-align:center}
.theme-toggle{position:relative;width:48px;height:28px}.theme-toggle input{opacity:0;width:0;height:0}.theme-toggle .slider{position:absolute;inset:0;background:var(--bg-tertiary);border-radius:999px;transition:background .15s;display:flex;align-items:center;padding:2px}.theme-toggle .slider::before{content:'';position:absolute;width:24px;height:24px;background:white;border-radius:50%;left:2px;transition:transform .15s;box-shadow:var(--shadow-sm)}.theme-toggle input:checked+.slider{background:var(--accent-primary)}.theme-toggle input:checked+.slider::before{transform:translateX(20px)}.theme-toggle .slider svg{position:absolute;width:16px;height:16px;color:var(--text-secondary)}.theme-toggle .slider .sun-icon{left:6px}.theme-toggle .slider .moon-icon{right:6px;opacity:0}.theme-toggle input:checked+.slider .sun-icon{opacity:0}.theme-toggle input:checked+.slider .moon-icon{opacity:1}
.btn-gerenciar{display:inline-flex;align-items:center;gap:6px;padding:0 14px;height:36px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-secondary);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s}.btn-gerenciar:hover{color:var(--accent-primary);border-color:var(--accent-primary);background:var(--bg-hover)}

.sidebar-left{position:fixed;top:64px;left:0;bottom:0;width:280px;background:var(--bg-secondary);border-right:1px solid var(--border-color);display:flex;flex-direction:column;overflow-y:auto;padding:16px;gap:24px;z-index:200;transform:translateX(-100%);transition:transform .3s}.sidebar-left.open{transform:translateX(0)}
.sidebar-section{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:16px}
.sidebar-section-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}
.filter-group{margin-bottom:16px}.filter-label{display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px}
.filter-select{appearance:none;background:var(--bg-input);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px;transition:all .15s;padding-right:40px}

.main{flex:1;display:flex;flex-direction:column;overflow:hidden;margin-left:0;transition:margin-left .3s}
.toolbar{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:var(--bg-secondary);border-bottom:1px solid var(--border-color);gap:12px;flex-wrap:wrap}
.chips-container{display:flex;flex-wrap:wrap;gap:4px;flex:1;min-width:0}
.chip{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:var(--accent-primary);color:white;border-radius:999px;font-size:11px;font-weight:500;max-width:200px}
.chip.remove-btn{width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.2);border:none;color:white;cursor:pointer;font-size:14px;padding:0}
.chip.remove-btn:hover{background:rgba(255,255,255,.3)}
.chip-category{background:var(--accent-purple)}.chip-status{background:var(--accent-warning)}.chip-priority{background:var(--accent-danger)}.chip-technician{background:var(--accent-secondary)}.chip-unit{background:#06b6d4}.chip-date{background:#8b5cf6}

.tabs{display:flex;background:var(--bg-secondary);border-bottom:1px solid var(--border-color);padding:0 16px}
.tab-btn{padding:12px 24px;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--text-secondary);font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:8px}
.tab-btn:hover{color:var(--text-primary);background:var(--bg-tertiary)}.tab-btn.active{color:var(--accent-primary);border-bottom-color:var(--accent-primary)}
.tab-content{flex:1;overflow:auto;padding:16px}.tab-panel{display:none}.tab-panel.active{display:block;animation:fadeIn .15s}@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}

.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px}@media(max-width:900px){.kpi-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:500px){.kpi-grid{grid-template-columns:1fr}}
.kpi-card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:16px;display:flex;align-items:flex-start;gap:16px;transition:all .15s}.kpi-card:hover{border-color:var(--border-light);box-shadow:var(--shadow-md)}
.kpi-icon{width:48px;height:48px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}.kpi-icon svg{width:24px;height:24px}
.kpi-card.abertos .kpi-icon{background:rgba(59,130,246,.15);color:var(--accent-primary)}
.kpi-card.andamento .kpi-icon{background:rgba(16,185,129,.15);color:var(--accent-secondary)}
.kpi-card.comunicado .kpi-icon{background:rgba(245,158,11,.15);color:var(--accent-warning)}
.kpi-card.resolvidos .kpi-icon{background:rgba(139,92,246,.15);color:var(--accent-purple)}
.kpi-content{flex:1;min-width:0}.kpi-label{font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:4px}.kpi-value{font-size:24px;font-weight:700;font-family:var(--font-mono);color:var(--text-primary);line-height:1}

.charts-grid{display:grid;grid-template-columns:1fr 2fr;gap:16px;margin-bottom:16px}@media(max-width:900px){.charts-grid{grid-template-columns:1fr}}
.charts-left{display:flex;flex-direction:column;gap:16px}
.chart-box{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:16px;flex:1}.chart-title{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:8px}.chart-box canvas{max-height:200px}

.table-container{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;overflow:hidden}
.table-wrapper{overflow-x:auto}
.table{width:100%;border-collapse:collapse;font-size:13px}
.table th,.table td{padding:8px 16px;text-align:left;border-bottom:1px solid var(--border-color)}
.table th{background:var(--bg-tertiary);font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;font-size:11px;white-space:nowrap;position:sticky;top:0;z-index:10}
.table tbody tr{transition:background .15s}.table tbody tr:hover{background:var(--bg-hover)}
.table td{color:var(--text-primary);vertical-align:middle}
.cell-protocolo{font-family:var(--font-mono);font-weight:600;color:var(--accent-primary)}
.cell-urgency{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600}
.urgency-critica{background:rgba(239,68,68,.15);color:var(--accent-danger)}.urgency-alta{background:rgba(249,115,22,.15);color:#f97316}.urgency-media{background:rgba(245,158,11,.15);color:var(--accent-warning)}.urgency-baixa{background:rgba(16,185,129,.15);color:var(--accent-secondary)}
.text-center{text-align:center}.text-right{text-align:right}
.categoria{font-size:11px;color:var(--text-muted);background:var(--bg-tertiary);border:1px solid var(--border-color);padding:2px 8px;border-radius:20px;font-family:var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.inventario-badge{font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600;display:inline-block}
.inventario-concluido{background:rgba(16,185,129,.15);color:var(--accent-secondary)}.inventario-andamento{background:rgba(245,158,11,.15);color:var(--accent-warning)}.inventario-nao-realizado{background:rgba(239,68,68,.15);color:var(--accent-danger)}.inventario-nao-informado{background:var(--bg-tertiary);color:var(--text-muted)}
.status-badge{font-size:11px;padding:2px 10px;border-radius:20px;font-weight:700;display:inline-block;letter-spacing:.02em;background:var(--bg-tertiary);color:var(--text-muted)}
.status-abertos{background:rgba(241,196,15,.18);color:#eab308}.status-andamento{background:rgba(59,130,246,.15);color:var(--accent-primary)}.status-comunicado{background:rgba(245,158,11,.15);color:var(--accent-warning)}.status-resolvidos{background:rgba(16,185,129,.15);color:var(--accent-secondary)}
.critico{color:var(--accent-danger);font-weight:700}

.kanban-board{display:flex;gap:16px;overflow-x:auto;padding:16px 0;min-height:500px}
.kanban-column{min-width:300px;max-width:340px;flex:1;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:12px;display:flex;flex-direction:column}
.kanban-column-header{display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid var(--border-color);background:var(--bg-secondary);border-radius:12px 12px 0 0}
.kanban-column-title{display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px}
.status-dot{width:8px;height:8px;border-radius:50%}.status-dot.status-abertos{background:#eab308}.status-dot.status-andamento{background:var(--accent-primary)}.status-dot.status-comunicado{background:var(--accent-warning)}.status-dot.status-resolvidos{background:var(--accent-secondary)}
.kanban-column-count{background:var(--bg-tertiary);color:var(--text-secondary);padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;font-family:var(--font-mono)}
.kanban-cards{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;min-height:400px}
.kanban-card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;padding:16px;cursor:pointer;transition:all .15s}.kanban-card:hover{border-color:var(--border-light);box-shadow:var(--shadow-md)}
.kanban-card-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px}.kanban-card-protocolo{font-family:var(--font-mono);font-weight:600;font-size:13px;color:var(--accent-primary)}.kanban-card-urgency{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px}
.kanban-card-body{font-size:13px;color:var(--text-secondary);margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.kanban-card-footer{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--text-muted)}

.grouped-view{display:flex;flex-direction:column;gap:16px}
.group-category{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;overflow:hidden}
.group-category-header{display:flex;align-items:center;justify-content:space-between;padding:16px;background:var(--bg-secondary);border-bottom:1px solid var(--border-color);cursor:pointer;transition:background .15s}
.group-category-header:hover{background:var(--bg-hover)}
.group-category-title{display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px}
.group-category-count{background:var(--bg-tertiary);color:var(--text-secondary);padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;font-family:var(--font-mono)}
.group-category-toggle{width:24px;height:24px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);transition:transform .15s}
.group-category.expanded .group-category-toggle{transform:rotate(180deg)}
.group-category-content{display:none;padding:16px}.group-category.expanded .group-category-content{display:block}
.group-unit{margin-bottom:16px}
.group-unit-header{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:var(--bg-tertiary);border-radius:8px;margin-bottom:8px;font-size:13px;font-weight:500;color:var(--text-primary)}
.group-unit-count{font-size:11px;color:var(--text-muted);font-family:var(--font-mono)}
.group-tickets{display:flex;flex-direction:column;gap:4px}
.group-ticket{display:flex;align-items:center;gap:8px;padding:8px 16px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;font-size:13px;cursor:pointer;transition:all .15s}.group-ticket:hover{border-color:var(--border-light);background:var(--bg-hover)}
.group-ticket-protocolo{font-family:var(--font-mono);font-weight:600;color:var(--accent-primary);min-width:100px}
.group-ticket-title{flex:1;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;opacity:0;visibility:hidden;transition:all .25s;padding:16px}
.modal-overlay.open{opacity:1;visibility:visible}
.modal{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;width:100%;max-width:800px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;transform:scale(.95) translateY(20px);transition:transform .25s}
.modal-overlay.open .modal{transform:scale(1) translateY(0)}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid var(--border-color);background:var(--bg-secondary)}
.modal-title{font-size:18px;font-weight:600;color:var(--text-primary)}
.modal-close{width:36px;height:36px;border:none;background:var(--bg-tertiary);color:var(--text-secondary);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s}
.modal-close:hover{background:var(--bg-hover);color:var(--accent-danger)}
.modal-body{flex:1;overflow:auto;padding:24px}
.detail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}@media(max-width:600px){.detail-grid{grid-template-columns:1fr}}
.detail-field{display:flex;flex-direction:column;gap:4px}.detail-field.full-width{grid-column:1/-1}
.detail-label{font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)}
.detail-value{font-size:13px;color:var(--text-primary);padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;font-family:var(--font-mono)}
.detail-value.long-text{font-family:var(--font-sans);white-space:pre-wrap;word-break:break-word;min-height:80px}
.email-link{color:var(--accent-primary);text-decoration:none;font-family:var(--font-sans)}.email-link:hover{text-decoration:underline}
.detail-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500}

.filter-bar{display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px;background:var(--bg-secondary);border-bottom:1px solid var(--border-color);align-items:center}
.filter-bar-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-right:4px}
.filter-bar select{flex:1 1 150px;max-width:220px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px;padding:8px 12px;outline:none;cursor:pointer;min-width:140px;height:38px}.filter-bar select:focus{border-color:var(--accent-primary)}
.modal-actions-resolver{display:flex;justify-content:flex-end;gap:10px;margin-top:16px;align-items:center}
.status-select-modal{background:var(--bg-input);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;padding:8px 12px;outline:none;cursor:pointer;font-family:var(--font-sans)}.status-select-modal:focus{border-color:var(--accent-primary)}
.modal-title-wrap{display:flex;align-items:center;min-width:0}
.modal-header-actions{display:flex;align-items:center;gap:8px}
.btn-atualizar-status{background:var(--accent-primary);color:#fff;border:none;border-radius:6px;padding:8px 12px;font-size:11px;font-weight:700;letter-spacing:.03em;cursor:pointer;white-space:nowrap;transition:filter .15s}.btn-atualizar-status:hover{filter:brightness(1.1)}
.resolver-box{width:100%;display:flex;flex-direction:column;gap:8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:10px;padding:16px}
.modal-status{max-width:560px}
.resolver-label{font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em}
.resolver-textarea{width:100%;min-height:80px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;padding:10px 12px;resize:vertical;font-family:var(--font-sans);outline:none}.resolver-textarea:focus{border-color:var(--accent-primary)}

@media(max-width:1024px){
  .sidebar-left{transform:translateX(-100%)}
  .sidebar-left.open{transform:translateX(0)}
}
/* End of styles */
</style> 
  
 