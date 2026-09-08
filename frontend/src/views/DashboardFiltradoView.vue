<template>
  <div class="dashboard-filtrado">
    <header class="header">
      <div class="header-left">
        <img src="https://i.ibb.co/3yBdJq67/IMG-9095.png" alt="Logo URE" height="40" />
        <h1>Fila de Chamados<small>Consulta · URE Leste 3</small></h1>
      </div>
      <div class="header-right">
        <span class="pulso-status"><span class="pulso-dot" :class="{ 'pulso-online': online }"></span>{{ statusAtualizacao }}</span>
        <span class="relogio" id="relogio"></span>
        <Button variant="ghost" size="sm" @click="recarregar" title="Atualizar dados"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6"/><circle cx="18" cy="18" r="3"/><path d="M1 2h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/></svg></Button>
        <Button variant="ghost" size="sm" @click="logout" title="Sair"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></Button>
      </div>
    </header>

    <div class="container">
      <div v-if="avisos.length > 0" class="aviso-mudancas">
        <div class="aviso-header"><span class="aviso-titulo">⚠ Atualizações recentes</span><Button variant="ghost" size="sm" @click="fecharAvisos">✕</Button></div>
        <div class="aviso-lista">
          <div v-for="a in avisos" :key="a.id" class="aviso-item" @click="abrirModal(a.id)">
            O chamado <b>{{ a.id }}</b> ({{ a.tipo }}) estava em <span class="de">{{ a.anterior }}</span> e passou para <span class="para">{{ a.atual }}</span>
            <span v-if="a.responsavel" class="quem"> — por {{ a.responsavel }}</span>
          </div>
        </div>
      </div>

      <div class="inventario-header">
        <div class="linha-info"><i class="fas fa-building"></i><strong>{{ filial }}</strong></div>
        <div class="linha-info"><i class="fas fa-user-cog"></i>Técnico do setor: <span>{{ tecnicoSetor }}</span></div>
        <div class="linha-info status-inventario" :class="classeInventario"><i class="fas fa-circle" style="font-size:8px;"></i><span class="rotulo">Inventário:</span><span>{{ inventarioStatus }}</span></div>
      </div>

      <div class="stats-bar">
        <div class="stat-item"><span class="stat-num">{{ stats.total }}</span><span class="stat-label">Total</span></div>
        <div class="stat-item aberto"><span class="stat-num">{{ stats.abertos }}</span><span class="stat-label">Aberto</span></div>
        <div class="stat-item andamento"><span class="stat-num">{{ stats.andamento }}</span><span class="stat-label">Em andamento</span></div>
        <div class="stat-item comunicado"><span class="stat-num">{{ stats.comunicado }}</span><span class="stat-label">Comunicado</span></div>
        <div class="stat-item resolvido"><span class="stat-num">{{ stats.resolvidos }}</span><span class="stat-label">Resolvido</span></div>
        <div class="stat-item alta"><span class="stat-num">{{ stats.alta }}</span><span class="stat-label">Alta prioridade</span></div>
      </div>

      <div class="barra-acoes">
        <div class="filtros">
          <Input placeholder="Categoria…" v-model="filtros.categoria" @input="aplicarFiltros" />
          <input type="date" v-model="filtros.dataDe" @change="aplicarFiltros" title="De" />
          <input type="date" v-model="filtros.dataAte" @change="aplicarFiltros" title="Até" />
          <Button variant="secondary" @click="limparFiltros">Limpar filtros</Button>
        </div>
        <div class="botoes-acoes">
          <Button variant="secondary" @click="exportarCsv"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Exportar</Button>
        </div>
      </div>

      <div class="table-shell">
        <div class="chamados-table-wrap" ref="tableWrap">
          <table class="chamados-table" v-if="chamadosFiltrados.length > 0">
            <thead>
              <tr>
                <th><span class="filtro-header">Protocolo</span></th>
                <th><span class="filtro-header">Status</span></th>
                <th><span class="filtro-header">Urgência</span></th>
                <th><span class="filtro-header">Unidade</span></th>
                <th><span class="filtro-header">Categoria</span></th>
                <th><span class="filtro-header">Aberto há</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in chamadosFiltrados" :key="c.id" :class="['chamado-row', 'urg-' + (c.urgencia?.split(' ')[0]?.toLowerCase() || 'baixa'), { resolvido: c.status === 'RESOLVIDO' }]" @click="abrirModal(c)">
                <td><span class="table-protocolo">{{ c.protocolo }}</span></td>
                <td><span class="badge-pill" :class="classeStatus(c.status)">{{ c.status }}</span></td>
                <td><span class="table-urgencia" :class="{ critico: isCritico(c) }">{{ c.urgencia?.split(' ')[0] || '-' }}</span></td>
                <td><span class="table-main" :title="c.unidade">{{ truncar(c.unidade, 48) }}</span></td>
                <td><span class="card-categoria" :title="c.tipo">{{ truncar(c.tipo, 28) }}</span></td>
                <td><span class="card-tempo" :class="{ critico: isCritico(c) }">{{ c.status === 'RESOLVIDO' ? 'Resolvido' : tempoDecorrido(c.timestamp) }}</span></td>
              </tr>
            </tbody>
          </table>
          <div v-else class="vazio-geral"><span class="icone">📭</span>Nenhum chamado encontrado com os filtros atuais.</div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" :class="{ open: modalAberto }" @click.self="fecharModal">
      <div class="modal" v-if="chamadoAtual">
        <div class="modal-cabecalho">
          <div class="modal-topo">
            <h3>{{ chamadoAtual.protocolo }}<Button variant="ghost" size="sm" @click="copiarChamado" class="btn-copiar" title="Copiar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></Button></h3>
            <Button variant="ghost" size="sm" @click="fecharModal">✕</Button>
          </div>
          <div class="badges-linha">
            <span class="badge-pill" :class="classeStatus(chamadoAtual.status)">{{ chamadoAtual.status }}</span>
            <span class="badge-pill" :class="classeUrgenciaBadge(chamadoAtual.urgencia)">{{ chamadoAtual.urgencia?.split(' ')[0] || '—' }}</span>
          </div>
        </div>
        <div class="modal-corpo">
          <div class="secao"><div class="secao-titulo">Solicitação</div>
            <div class="info-grid">
              <div class="info-item"><div class="k">Unidade</div><div class="v">{{ chamadoAtual.unidade }}</div></div>
              <div class="info-item"><div class="k">Aberto em</div><div class="v">{{ formatDate(chamadoAtual.timestamp) }}</div></div>
              <div class="info-item"><div class="k">Solicitante</div><div class="v">{{ chamadoAtual.solicitante }}</div></div>
              <div class="info-item"><div class="k">Cargo</div><div class="v">{{ chamadoAtual.funcao || '—' }}</div></div>
              <div class="info-item"><div class="k">Categoria</div><div class="v">{{ chamadoAtual.tipo }}</div></div>
            </div>
          </div>
          <div class="secao"><div class="secao-titulo">Descrição</div><div class="descricao-box">{{ chamadoAtual.descricao || '—' }}</div></div>
          <div class="secao"><div class="secao-titulo">Atendimento</div>
            <div class="info-grid">
              <div class="info-item"><div class="k">Técnico do setor</div><div class="v">{{ chamadoAtual.tecnicoSetor || '— não mapeado —' }}</div></div>
              <div class="info-item"><div class="k">Técnico que resolveu</div><div class="v">{{ chamadoAtual.tecnicoResolucao || '—' }}</div></div>
              <div class="info-item full"><div class="k">Inventário da escola</div><div class="v">{{ chamadoAtual.inventarioStatus || 'Não informado' }}</div></div>
            </div>
          </div>
          <div class="secao"><div class="secao-titulo">Linha do tempo</div>
            <div class="timeline-box">
              <div class="timeline" v-if="timeline.length > 0">
                <div class="timeline-item" v-for="t in timeline" :key="t.data">
                  <span class="timeline-dot" :class="{ resposta: t.tipo === 'resposta' }"></span>
                  <div class="timeline-data">{{ t.data }}</div>
                  <div class="timeline-texto">{{ t.texto }}</div>
                </div>
              </div>
              <div v-else class="timeline-vazio">Sem histórico ainda — chamado recém aberto.</div>
            </div>
          </div>
          <div class="aviso-somente-leitura">🔒 Modo somente leitura — para responder ou alterar este chamado, entre em contato com a URE.</div>
          <div class="modal-actions"><Button variant="secondary" @click="fecharModal">Fechar</Button></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChamadosStore } from '@/stores/chamados'
import { useUIStore } from '@/stores/ui'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

const router = useRouter()
const auth = useAuthStore()
const chamados = useChamadosStore()
const ui = useUIStore()

const token = ref('')
const filial = ref('')
const tecnicoSetor = ref('')
const inventarioStatus = ref('')
const avisos = ref<any[]>([])
const modalAberto = ref(false)
const chamadoAtual = ref<any>(null)
const online = ref(true)
const statusAtualizacao = ref('sincronizando…')

const filtros = reactive({categoria:'',dataDe:'',dataAte:''})
const stats = reactive({total:0,abertos:0,andamento:0,comunicado:0,resolvidos:0,alta:0})

onMounted(async()=>{
  await auth.initialize()
  if(!auth.isAuthenticated){router.push('/login');return}
  filial.value = auth.user?.filial || 'Unidade não identificada'
  await chamados.carregarFiltrado()
  updateStats()
  montarAvisos()
  online.value = true
  statusAtualizacao.value = 'atualizado agora'
})

watch(()=>chamados.lista,()=>{updateStats();montarAvisos()},{deep:true})

async function recarregar(){await chamados.carregarFiltrado();online.value=true;statusAtualizacao.value='atualizado agora'}

function updateStats(){
  stats.total = chamados.lista.length
  stats.abertos = chamados.lista.filter(c=>c.status==='ABERTO').length
  stats.andamento = chamados.lista.filter(c=>c.status==='ANDAMENTO').length
  stats.comunicado = chamados.lista.filter(c=>c.status==='COMUNICADO').length
  stats.resolvidos = chamados.lista.filter(c=>c.status==='RESOLVIDO').length
  stats.alta = chamados.lista.filter(c=>c.urgencia?.startsWith('Alta')&&c.status!=='RESOLVIDO').length
  
  if(chamados.lista.length>0){
    const p = chamados.lista[0]
    tecnicoSetor.value = p.tecnicoSetor || 'Não mapeado'
    inventarioStatus.value = p.inventarioStatus || 'Não informado'
  }
}

const classeInventario = computed(()=>{
  if(inventarioStatus.value==='CONCLUIDO')return'concluido'
  if(inventarioStatus.value==='EM_ANDAMENTO')return'andamento'
  if(inventarioStatus.value==='NAO_REALIZADO')return'nao-realizado'
  return'nao-informado'
})

const chamadosFiltrados = computed(()=>{
  let r = chamados.lista
  if(filtros.categoria) r = r.filter(c=>c.tipo?.toLowerCase().includes(filtros.categoria.toLowerCase()))
  if(filtros.dataDe) r = r.filter(c=>new Date(c.timestamp) >= new Date(filtros.dataDe+'T00:00:00'))
  if(filtros.dataAte) r = r.filter(c=>new Date(c.timestamp) <= new Date(filtros.dataAte+'T23:59:59'))
  return r.sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())
})

function limparFiltros(){
  filtros.categoria = ''
  filtros.dataDe = ''
  filtros.dataAte = ''
}

function montarAvisos(){
  const agora = Date.now()
  const janela = 24*3600*1000
  const mudancas:any[] = []
  chamados.lista.forEach(c=>{
    const ult = c.ultimaAtualizacao ? new Date(c.ultimaAtualizacao).getTime() : null
    if(!ult || (agora-ult)>janela) return
    const hist = c.historico || ''
    const linhas = hist.split('\n')
    let ultima:any = null, anterior = 'ABERTO'
    linhas.forEach(l=>{
      const m = l.match(/Status alterado para\s*"([^"]+)"\s*por\s*([^\(]+?)(?:\s*\(técnico:\s*([^)]+)\))?\s*$/)
      if(m){anterior = ultima ? ultima.status : 'ABERTO'; ultima = {status:m[1].trim(),responsavel:m[2]?.trim()||'',tecnico:m[3]?.trim()}}
    })
    if(ultima && ultima.status!==anterior){
      mudancas.push({id:c.id,tipo:c.tipo||'Sem categoria',anterior,atual:ultima.status,responsavel:ultima.responsavel,quando:ult})
    }
  })
  mudancas.sort((a,b)=>b.quando-a.quando)
  avisos.value = mudancas.slice(0,10)
}

function abrirModal(id:string){
  chamadoAtual.value = chamados.lista.find(c=>c.id===id)
  if(chamadoAtual.value) modalAberto.value = true
}

function fecharModal(){modalAberto.value=false;chamadoAtual.value=null}

function fecharAvisos(){avisos.value=[]}

async function logout(){
  if(!confirm('Deseja realmente sair?')) return
  await auth.logout()
  router.push('/login')
}

async function copiarChamado(){
  if(!chamadoAtual.value) return
  const d = chamadoAtual.value
  const txt = `PROTOCOLO: ${d.protocolo}\nUNIDADE: ${d.unidade}\nSOLICITANTE: ${d.solicitante}\nCARGO: ${d.funcao||'—'}\nTIPO: ${d.tipo}\nURGÊNCIA: ${d.urgencia}\nSTATUS: ${d.status}\nTÉCNICO: ${d.tecnicoSetor||'—'}\nINVENTÁRIO: ${d.inventarioStatus||'—'}\nABERTO: ${formatDate(d.timestamp)}\nDESCRIÇÃO:\n${d.descricao||'—'}`
  await navigator.clipboard.writeText(txt)
  ui.showToast('success','Chamado copiado')
}

function exportarCsv(){
  const headers = ['Protocolo','Unidade','Solicitante','Cargo','Tipo','Descrição','Urgência','Status','Técnico','Inventário','Aberto em']
  const rows = chamadosFiltrados.value.map(c=>[c.protocolo,c.unidade,c.solicitante,c.funcao||'',c.tipo,(c.descricao||'').replace(/;/g,','),c.urgencia,c.status,c.tecnicoSetor||'',c.inventarioStatus||'',formatDate(c.timestamp)])
  const csv = [headers.join(';'),...rows.map(r=>r.join(';'))].join('\n')
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `chamados_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  ui.showToast('success','CSV exportado')
}

function classeStatus(s:string){if(s==='ABERTO')return'status-aberto';if(s==='ANDAMENTO')return'status-andamento';if(s==='COMUNICADO')return'status-comunicado';return'status-resolvido'}
function classeUrgenciaBadge(u:string){if(!u)return'urg-pill-baixa';if(u.startsWith('Alta'))return'urg-pill-alta';if(u.startsWith('Média'))return'urg-pill-media';return'urg-pill-baixa'}
function isCritico(c:any){const ms=Date.now()-new Date(c.timestamp).getTime();return ms/3600000>4&&c.status!=='RESOLVIDO'}
function tempoDecorrido(ts:string){const ms=Date.now()-new Date(ts).getTime();const h=ms/3600000;if(h<1)return Math.round(ms/60000)+' min';if(h<24)return Math.round(h)+'h';return Math.round(h/24)+'d'}
function truncar(t:string,max:number){return t.length>max?t.slice(0,max-1)+'…':t}
function formatDate(ts:string){return new Date(ts).toLocaleString('pt-BR')}

function parseTimeline(hist:string){
  if(!hist) return []
  return hist.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const m=l.match(/^\[(.+?)\]\s*(.+)$/);if(!m)return null;return{data:m[1],texto:m[2],tipo:/Status alterado/.test(m[2])?'status':'resposta'}}).filter(Boolean)
}

const timeline = computed(()=>parseTimeline(chamadoAtual.value?.historico||''))

let clockInterval: number

const clock = () => {
  const el = document.getElementById('relogio')
  if (el) el.textContent = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
}

onMounted(() => {
  clock()
  clockInterval = window.setInterval(clock, 1000)
})

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
})
</script>

<style scoped>
/* Light theme styles matching DashboardFiltrado.html */
.dashboard-filtrado{background:#f4f6fa;color:#1c1e26;min-height:100vh;font-family:'Inter',sans-serif}
.header{display:flex;justify-content:space-between;align-items:center;padding:14px 24px;border-bottom:1px solid #e2e6ed;background:#fff;position:sticky;top:0;z-index:50;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.header-left{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.header-left img{height:40px;margin-right:8px}.header h1{font-size:18px;font-weight:800;letter-spacing:-0.3px}.header h1 small{display:block;font-size:10.5px;font-weight:500;color:#8a94a6;letter-spacing:.04em;margin-top:1px;text-transform:uppercase}
.header-right{display:flex;align-items:center;gap:12px;background:#f0f2f5;border:1px solid #e2e6ed;border-radius:10px;padding:7px}
.pulso-status{display:flex;align-items:center;gap:7px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#5b6373}.pulso-dot{width:8px;height:8px;border-radius:50%;background:#0f9d58;box-shadow:0 0 0 0 rgba(15,157,88,.5);animation:pulso-anel 2s infinite}.pulso-dot.pulso-online{animation:pulso-anel 2s infinite}@keyframes pulso-anel{0%{box-shadow:0 0 0 0 rgba(15,157,88,.45)}70%{box-shadow:0 0 0 7px rgba(15,157,88,0)}100%{box-shadow:0 0 0 0 rgba(15,157,88,0)}}.relogio{font-family:'JetBrains Mono',monospace;font-size:12px;color:#5b6373;font-variant-numeric:tabular-nums}
.btn{background:#f0f2f5;border:1px solid #d0d5dd;color:#5b6373;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;transition:all .15s}.btn:hover{background:#e8ebf0;border-color:#b0b8c4;color:#1c1e26;transform:translateY(-1px)}

.container{padding:16px 24px 32px;max-width:1560px;margin:0 auto}
.aviso-mudancas{display:none;background:#e3edfc;border:1px solid #b3cff5;border-left:4px solid #1a73e8;border-radius:10px;padding:12px 16px;margin-bottom:16px}.aviso-mudancas{display:block}.aviso-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}.aviso-titulo{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#1a73e8;display:flex;align-items:center;gap:8px}.aviso-fechar{background:none;border:none;color:#5b6373;cursor:pointer;font-size:14px;padding:0 4px}.aviso-fechar:hover{color:#1c1e26}.aviso-lista{display:flex;flex-direction:column;gap:6px}.aviso-item{background:rgba(255,255,255,.6);border:1px solid #e2e6ed;border-radius:8px;padding:8px 12px;font-size:12px;color:#1c1e26;cursor:pointer;transition:.12s}.aviso-item:hover{background:#fff;border-color:#d0d5dd}.aviso-item b{color:#1a73e8;font-family:'JetBrains Mono',monospace}.aviso-item .de{color:#f1c40f;font-weight:600}.aviso-item .para{color:#0f9d58;font-weight:600}.aviso-item .quem{color:#5b6373}

.inventario-header{display:flex;flex-direction:column;gap:8px;align-items:flex-start;background:#fff;border:1px solid #e2e6ed;border-radius:10px;padding:12px 20px;margin-bottom:16px}.linha-info{display:flex;align-items:center;gap:10px;font-size:13px;color:#5b6373;width:100%}.linha-info i{flex-shrink:0;color:#1a73e8;width:20px;text-align:center}.linha-info strong{color:#1c1e26;font-weight:700}.status-inventario{display:flex;align-items:center;gap:8px;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;width:auto}.status-inventario .rotulo{font-weight:400;color:#5b6373;text-transform:none;margin-right:4px}.status-inventario.concluido{background:#e2f4e9;color:#0f9d58}.status-inventario.andamento{background:#fdf0e6;color:#e67e22}.status-inventario.nao-realizado{background:#fce8e6;color:#d93025}.status-inventario.nao-informado{background:#f0f2f5;color:#8a94a6}

.stats-bar{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:16px}@media(max-width:1200px){.stats-bar{grid-template-columns:repeat(3,1fr)}}@media(max-width:768px){.stats-bar{grid-template-columns:1fr 1fr}}.stat-item{background:#fff;border:1px solid #e2e6ed;border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.02);transition:.15s;min-height:80px}.stat-item:hover{border-color:#1a73e8;box-shadow:0 4px 12px rgba(26,115,232,.08)}.stat-num{font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:700;color:#1c1e26;line-height:1.2}.stat-label{font-size:11px;color:#5b6373;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}.stat-item.alta .stat-num{color:#d93025}.stat-item.resolvido .stat-num{color:#0f9d58}.stat-item.aberto .stat-num{color:#f1c40f}.stat-item.andamento .stat-num{color:#1a73e8}.stat-item.comunicado .stat-num{color:#e67e22}

.barra-acoes{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;background:#fff;border:1px solid #e2e6ed;border-radius:10px;padding:12px 18px}.filtros{display:flex;gap:8px;flex-wrap:wrap;flex:1}.filtros input,.filtros select{background:#f0f2f5;border:1px solid #d0d5dd;color:#1c1e26;padding:7px 11px;border-radius:7px;font-size:12px;font-family:'Inter',sans-serif;outline:none;transition:border .15s;min-height:38px}.filtros input:focus,.filtros select:focus{border-color:#1a73e8}.filtros input::placeholder{color:#8a94a6}.filtros button{background:#f0f2f5;border:1px solid #d0d5dd;color:#5b6373;padding:7px 14px;border-radius:7px;cursor:pointer;font-size:12px;font-family:'Inter',sans-serif;min-height:38px}.filtros button:hover{background:#e8ebf0;color:#1c1e26}
.botoes-acoes{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.btn-exportar{display:inline-flex;align-items:center;gap:8px;background:#f0f2f5;color:#1c1e26;font-weight:700;padding:9px 18px;border-radius:8px;text-decoration:none;font-size:13px;transition:.15s;white-space:nowrap;border:1px solid #d0d5dd;cursor:pointer;min-height:38px}.btn-exportar:hover{background:#e8ebf0;border-color:#1a73e8}

.table-shell{background:#fff;border:1px solid #e2e6ed;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.03)}
.chamados-table-wrap{overflow:auto;max-height:calc(100vh - 380px);min-height:360px}
.chamados-table{width:100%;border-collapse:separate;border-spacing:0;min-width:900px}
.chamados-table th{position:sticky;top:0;z-index:3;padding:12px 14px;background:#f0f2f5;border-bottom:2px solid #d0d5dd;color:#8a94a6;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;text-align:left;white-space:nowrap}
.chamados-table td{padding:13px 14px;border-bottom:1px solid #e2e6ed;color:#1c1e26;font-size:12.5px;vertical-align:middle}
.chamado-row{cursor:pointer;transition:background .12s}.chamado-row:hover{background:#f0f2f5}.chamado-row.resolvido{background:#e2f4e9}.chamado-row.resolvido:hover{background:#d0f0dd}
.chamado-row.urg-alta td:first-child{box-shadow:inset 4px 0 0 #d93025}.chamado-row.urg-media td:first-child{box-shadow:inset 4px 0 0 #f1c40f}.chamado-row.urg-baixa td:first-child{box-shadow:inset 4px 0 0 #0f9d58}
.table-protocolo{font-family:'JetBrains Mono',monospace;font-weight:800;color:#1c1e26}
.table-main{display:inline-block;max-width:360px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.table-urgencia{font-weight:800;color:#5b6373}.table-urgencia.critico{color:#d93025}
.badge-pill{border-radius:5px;white-space:nowrap;font-size:10.5px;padding:4px 12px;border-radius:20px;font-weight:700;letter-spacing:.02em}
.status-aberto{background:#fdf0e6;color:#e67e22}.status-andamento{background:#e3edfc;color:#1a73e8}.status-comunicado{background:#fdf0e6;color:#e67e22}.status-resolvido{background:#e2f4e9;color:#0f9d58}
.urg-pill-alta{background:#fce8e6;color:#d93025}.urg-pill-media{background:#fdf0e6;color:#e67e22}.urg-pill-baixa{background:#e2f4e9;color:#0f9d58}
.card-categoria{max-width:210px;border-radius:5px;display:inline-block;font-size:10px;color:#5b6373;background:#f0f2f5;border:1px solid #e2e6ed;padding:2px 8px;border-radius:20px;font-family:'JetBrains Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-tempo{font-family:'JetBrains Mono',monospace;font-size:11px;color:#5b6373}.card-tempo.critico{color:#d93025;font-weight:700}
.vazio-geral{text-align:center;padding:60px 20px;color:#5b6373;font-size:13px}.vazio-geral .icone{font-size:26px;display:block;margin-bottom:10px;opacity:.5}

.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.3);backdrop-filter:blur(4px);align-items:center;justify-content:center;z-index:200;padding:20px}
.modal-overlay.open{display:flex}
.modal{background:#fff;border:1px solid #e2e6ed;border-radius:14px;width:600px;max-width:100%;max-height:88vh;overflow-y:auto;animation:modal-entrada .18s ease-out;box-shadow:0 20px 48px rgba(0,0,0,.12)}@keyframes modal-entrada{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
.modal-cabecalho{padding:20px 24px 16px;border-bottom:1px solid #e2e6ed;background:#f0f2f5;position:sticky;top:0;z-index:2;border-radius:14px 14px 0 0}
.modal-topo{display:flex;justify-content:space-between;align-items:flex-start}.modal h3{font-size:16px;font-weight:700;color:#1a73e8;font-family:'JetBrains Mono',monospace;letter-spacing:-0.2px;display:flex;align-items:center;gap:9px}
.btn-copiar{background:#f0f2f5;border:1px solid #d0d5dd;color:#5b6373;width:30px;height:30px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:.15s;flex-shrink:0}.btn-copiar:hover{background:#e8ebf0;color:#1c1e26;border-color:#1a73e8}.btn-copiar svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.btn-copiar.copiado{border-color:#0f9d58;color:#0f9d58}
.modal .fechar-x{background:none;border:none;color:#5b6373;font-size:20px;cursor:pointer;padding:0 4px;line-height:1}.modal .fechar-x:hover{color:#1c1e26}
.badges-linha{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.modal-corpo{padding:18px 24px 24px}
.secao{margin-bottom:20px}.secao:last-child{margin-bottom:0}
.secao-titulo{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#8a94a6;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px}@media(max-width:768px){.info-grid{grid-template-columns:1fr}}.info-item .k{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:#8a94a6;font-weight:700}.info-item .v{font-size:13px;margin-top:3px;word-break:break-word;color:#1c1e26}.info-item.full{grid-column:1/-1}
.descricao-box{background:#f0f2f5;border:1px solid #e2e6ed;border-left:3px solid #1a73e8;border-radius:0 8px 8px 0;padding:12px 14px;font-size:13px;color:#1c1e26;line-height:1.6;white-space:pre-wrap}
.timeline-box{background:#f0f2f5;border:1px solid #e2e6ed;border-radius:8px;padding:14px 14px 14px 22px;max-height:220px;overflow-y:auto}
.timeline{position:relative}.timeline::before{content:'';position:absolute;left:-14px;top:4px;bottom:4px;width:2px;background:#e2e6ed}
.timeline-item{position:relative;padding-bottom:14px}.timeline-item:last-child{padding-bottom:0}
.timeline-dot{position:absolute;left:-19px;top:3px;width:9px;height:9px;border-radius:50%;background:#1a73e8;box-shadow:0 0 0 3px #f0f2f5}.timeline-dot.resposta{background:#8a94a6}
.timeline-data{font-family:'JetBrains Mono',monospace;font-size:10px;color:#8a94a6;margin-bottom:2px}.timeline-texto{font-size:12px;color:#1c1e26;line-height:1.5}.timeline-vazio{color:#5b6373;font-size:12px;padding:4px 0}
.aviso-somente-leitura{display:flex;align-items:center;gap:8px;background:#f0f2f5;border:1px solid #e2e6ed;border-radius:8px;padding:9px 13px;font-size:11.5px;color:#5b6373;margin-top:18px}
.modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}
.btn-secundario{background:transparent;border:1px solid #d0d5dd;color:#5b6373;padding:9px 22px;border-radius:8px;cursor:pointer;font-family:'Inter',sans-serif;transition:.15s}.btn-secundario:hover{background:#f0f2f5}

@media(max-width:768px){
  .header{flex-direction:column;align-items:flex-start;gap:12px;padding:12px 16px}
  .header-right{width:100%;flex-wrap:wrap;justify-content:space-between}
  .container{padding:12px 14px}
  .stats-bar{grid-template-columns:1fr 1fr}
  .stat-item{min-height:70px;padding:12px}.stat-num{font-size:22px}
  .barra-acoes{flex-direction:column;align-items:stretch}
  .filtros{flex-direction:column}
  .botoes-acoes{justify-content:stretch}
  .chamados-table-wrap{max-height:none;min-height:280px}
  .modal{width:100%;max-height:100vh;border-radius:0}
}
</style>