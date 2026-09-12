<template>
  <div class="admin-usuarios">
    <header class="header">
      <div class="header-left">
        <Button variant="ghost" size="sm" @click="router.push('/dashboard')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></Button>
        <h1>Administração de Usuários</h1>
      </div>
      <div class="header-right">
        <Button variant="primary" @click="abrirModalCriar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Novo Usuário</Button>
      </div>
    </header>

    <main class="main">
      <div class="toolbar">
        <div class="chips-container">
          <span v-if="filtros.search" class="chip">Busca: {{ filtros.search }}<button class="remove-btn" @click="filtros.search=''">×</button></span>
          <span v-if="filtros.nivel" class="chip chip-category">Nível: {{ filtros.nivel }}<button class="remove-btn" @click="filtros.nivel=''">×</button></span>
          <span v-if="filtros.status" class="chip chip-status">Status: {{ filtros.status }}<button class="remove-btn" @click="filtros.status=''">×</button></span>
        </div>
        <div class="toolbar-actions">
          <Button variant="secondary" @click="limparFiltros"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Limpar</Button>
        </div>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Nível</th>
              <th>Filial</th>
              <th>Status</th>
              <th>Primeiro Login</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in usuariosFiltrados" :key="u.id">
              <td>{{ u.nome }}</td>
              <td>{{ u.email }}</td>
              <td><span class="badge" :class="classeNivel(u.nivel)">{{ u.nivel }}</span></td>
              <td>{{ u.filial }}</td>
              <td><span class="badge" :class="classeStatus(u.status)">{{ u.status }}</span></td>
              <td><span class="badge" :class="u.primeiroLogin ? 'badge-warning' : 'badge-success'">{{ u.primeiroLogin ? 'Sim' : 'Não' }}</span></td>
              <td>
                <div class="acoes-cell">
                  <Button variant="ghost" size="sm" @click="abrirModalEditar(u)" title="Editar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5a2.121 2.121 0 0 1 3 3z"/></svg></Button>
                  <Button variant="ghost" size="sm" class="btn-danger" @click="confirmarDesativar(u)" title="Desativar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></Button>
                  <Button variant="ghost" size="sm" class="btn-warning" @click="gerarSenhaTemporaria(u)" title="Gerar senha temporária"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></Button>
                </div>
              </td>
            </tr>
            <tr v-if="usuariosFiltrados.length === 0"><td colspan="7" class="text-center" style="padding:48px 20px;color:var(--text-muted);">Nenhum usuário encontrado</td></tr>
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <Button variant="secondary" size="sm" @click="paginaAtual--" :disabled="paginaAtual===1">← Anterior</Button>
        <span class="pagination-info">Página {{ paginaAtual }} de {{ totalPaginas }} ({{ totalRegistros }} usuários)</span>
        <Button variant="secondary" size="sm" @click="paginaAtual++" :disabled="paginaAtual>=totalPaginas">Próxima →</Button>
      </div>
    </main>

    <div class="modal-overlay" :class="{ open: modalAberto }" @click.self="fecharModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">{{ editando ? 'Editar Usuário' : 'Novo Usuário' }}</h2>
          <Button variant="ghost" size="sm" @click="fecharModal" class="modal-close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></Button>
        </div>
        <form @submit.prevent="salvarUsuario" class="modal-body">
          <div class="form-grid">
            <div class="form-group"><label for="modal-nome">Nome *</label><Input id="modal-nome" v-model="formUsuario.nome" placeholder="Nome completo" :error="errors.nome" required /></div>
            <div class="form-group"><label for="modal-email">E-mail *</label><Input id="modal-email" v-model="formUsuario.email" type="email" placeholder="usuario@dominio.com" :error="errors.email" required /></div>
            <div class="form-group"><label for="modal-nivel">Nível *</label><Select id="modal-nivel" v-model="formUsuario.nivel" :options="nivelOptions" placeholder="— Selecione —" :error="errors.nivel" required /></div>
            <div class="form-group"><label for="modal-filial">Filial *</label><Select id="modal-filial" v-model="formUsuario.filial" :options="filialOptions" placeholder="— Selecione —" :error="errors.filial" required /></div>
            <div class="form-group"><label for="modal-status">Status *</label><Select id="modal-status" v-model="formUsuario.status" :options="statusOptions" placeholder="— Selecione —" :error="errors.status" required /></div>
          </div>
          <p v-if="senhaTemporaria" class="senha-temporaria">Senha temporária gerada: <strong>{{ senhaTemporaria }}</strong> — Copie e entregue ao usuário.</p>
          <div class="modal-actions">
            <Button variant="secondary" @click="fecharModal">Cancelar</Button>
            <Button variant="primary" type="submit" :loading="salvando">{{ editando ? 'Salvar' : 'Criar' }}</Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import api from '@/api/client'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'

const router = useRouter()
const auth = useAuthStore()
const ui = useUIStore()

const modalAberto = ref(false)
const editando = ref(false)
const salvando = ref(false)
const senhaTemporaria = ref('')
const usuarioId = ref('')

const filtros = reactive({search:'',nivel:'',status:''})
const paginaAtual = ref(1)
const totalPaginas = ref(1)
const totalRegistros = ref(0)

const usuarios = ref<any[]>([])
const usuariosFiltrados = computed(()=>{
  let r = usuarios.value
  if(filtros.search) r = r.filter(u=>u.nome.toLowerCase().includes(filtros.search.toLowerCase())||u.email.toLowerCase().includes(filtros.search.toLowerCase()))
  if(filtros.nivel) r = r.filter(u=>u.nivel===filtros.nivel)
  if(filtros.status) r = r.filter(u=>u.status===filtros.status)
  totalRegistros.value = r.length
  totalPaginas.value = Math.ceil(totalRegistros.value/20)
  return r.slice((paginaAtual.value-1)*20,paginaAtual.value*20)
})

const formUsuario = reactive({nome:'',email:'',nivel:'',filial:'',status:'ATIVO'})
const errors = reactive({nome:'',email:'',nivel:'',filial:'',status:''})

const nivelOptions = [{value:'ADMIN',label:'Administrador'},{value:'TECNICO',label:'Técnico'},{value:'GESTOR',label:'Gestor'},{value:'VISUALIZADOR',label:'Visualizador'}]
const filialOptions = [{value:'URE Leste 3',label:'URE Leste 3'},{value:'SETEC',label:'SETEC'}]
const statusOptions = [{value:'ATIVO',label:'Ativo'},{value:'INATIVO',label:'Inativo'}]

onMounted(async()=>{
  await auth.initialize()
  if(!auth.isAuthenticated || auth.user?.nivel!=='ADMIN'){router.push('/dashboard');return}
  await carregarUsuarios()
})

async function carregarUsuarios(){
  try{
    const {data} = await api.get('/usuarios')
    usuarios.value = data?.data || data || []
  }catch{}
}

function abrirModalCriar(){
  editando.value = false
  usuarioId.value = ''
  formUsuario.nome = ''
  formUsuario.email = ''
  formUsuario.nivel = ''
  formUsuario.filial = ''
  formUsuario.status = 'ATIVO'
  senhaTemporaria.value = ''
  Object.keys(errors).forEach(k=>errors[k as keyof typeof errors]='')
  modalAberto.value = true
}

function abrirModalEditar(u:any){
  editando.value = true
  usuarioId.value = u.id
  formUsuario.nome = u.nome
  formUsuario.email = u.email
  formUsuario.nivel = u.nivel
  formUsuario.filial = u.filial
  formUsuario.status = u.status
  senhaTemporaria.value = ''
  Object.keys(errors).forEach(k=>errors[k as keyof typeof errors]='')
  modalAberto.value = true
}

function fecharModal(){
  modalAberto.value = false
  senhaTemporaria.value = ''
}

async function salvarUsuario(){
  errors.nome = formUsuario.nome?'':'Nome obrigatório'
  errors.email = formUsuario.email&&formUsuario.email.includes('@')?'':'E-mail inválido'
  errors.nivel = formUsuario.nivel?'':'Selecione o nível'
  errors.filial = formUsuario.filial?'':'Selecione a filial'
  errors.status = formUsuario.status?'':'Selecione o status'
  if(Object.values(errors).some(e=>e)) return

  salvando.value = true
  try{
    if(editando.value){
      await api.patch(`/usuarios/${usuarioId.value}`, { nome: formUsuario.nome, nivel: formUsuario.nivel, filial: formUsuario.filial, status: formUsuario.status })
      ui.showToast('success', 'Usuário atualizado')
      await carregarUsuarios()
      fecharModal()
    }else{
      const {data} = await api.post('/usuarios', { nome: formUsuario.nome, email: formUsuario.email, nivel: formUsuario.nivel, filial: formUsuario.filial })
      senhaTemporaria.value = data?.senhaTemporaria || ''
      ui.showToast('success', senhaTemporaria.value ? 'Usuário criado — copie a senha temporária' : 'Usuário criado')
      await carregarUsuarios()
    }
  }catch(err:any){
    ui.showToast('error', err.response?.data?.message || 'Erro ao salvar')
  }finally{
    salvando.value = false
  }
}

async function confirmarDesativar(u:any){
  if(!confirm(`Remover usuário ${u.nome}?`)) return
  try{
    await api.delete(`/usuarios/${u.id}`)
    ui.showToast('success','Usuário removido')
    await carregarUsuarios()
  }catch(err:any){
    ui.showToast('error', err.response?.data?.message || 'Erro ao remover')
  }
}

async function gerarSenhaTemporaria(u:any){
  try{
    const {data} = await api.post('/auth/admin/gerar-senha-temporaria',{email:u.email})
    ui.showToast('success',`Senha temporária gerada: ${data.senhaTemporaria}`)
  }catch(err:any){
    ui.showToast('error', err.response?.data?.message || 'Erro ao gerar senha')
  }
}

function limparFiltros(){filtros.search='';filtros.nivel='';filtros.status='';paginaAtual.value=1}

function classeNivel(n:string){if(n==='ADMIN')return'badge-purple';if(n==='TECNICO')return'badge-blue';if(n==='GESTOR')return'badge-green';return'badge-gray'}
function classeStatus(s:string){if(s==='ATIVO')return'badge-success';return'badge-gray'}
</script>

<style scoped>
.admin-usuarios{display:flex;flex-direction:column;min-height:100vh;background:var(--bg-primary)}
.header{display:flex;align-items:center;justify-content:space-between;height:64px;padding:0 24px;background:var(--bg-secondary);border-bottom:1px solid var(--border-color)}
.header-left{display:flex;align-items:center;gap:12px}.header-left h1{font-size:20px;font-weight:700}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--bg-primary);padding:16px 24px}
.toolbar{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:var(--bg-secondary);border-bottom:1px solid var(--border-color);gap:12px;flex-wrap:wrap}
.chips-container{display:flex;flex-wrap:wrap;gap:4px;flex:1;min-width:0}
.chip{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:var(--accent-primary);color:white;border-radius:999px;font-size:11px;font-weight:500;max-width:200px}
.chip.remove-btn{width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.2);border:none;color:white;cursor:pointer;font-size:14px;padding:0}
.chip-category{background:var(--accent-purple)}.chip-status{background:var(--accent-warning)}
.table-container{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;overflow:hidden;flex:1;overflow:auto}
.table{width:100%;border-collapse:collapse;font-size:13px}
.table th,.table td{padding:12px 16px;text-align:left;border-bottom:1px solid var(--border-color)}
.table th{background:var(--bg-tertiary);font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;font-size:11px;white-space:nowrap;position:sticky;top:0;z-index:10}
.table td{color:var(--text-primary);vertical-align:middle}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.badge-purple{background:rgba(168,85,247,.15);color:var(--accent-purple)}
.badge-blue{background:rgba(59,130,246,.15);color:var(--accent-primary)}
.badge-green{background:rgba(16,185,129,.15);color:var(--accent-secondary)}
.badge-gray{background:var(--bg-tertiary);color:var(--text-muted)}
.badge-success{background:rgba(16,185,129,.15);color:var(--accent-secondary)}
.badge-warning{background:rgba(245,158,11,.15);color:var(--accent-warning)}
.acoes-cell{display:flex;gap:4px}
.btn-danger{color:var(--accent-danger)}.btn-danger:hover{background:rgba(239,68,68,.1)}.btn-warning{color:var(--accent-warning)}.btn-warning:hover{background:rgba(245,158,11,.1)}
.text-center{text-align:center}
.pagination{display:flex;align-items:center;justify-content:center;gap:16px;padding:16px 0;border-top:1px solid var(--border-color);margin-top:16px}
.pagination-info{font-size:13px;color:var(--text-secondary)}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;opacity:0;visibility:hidden;transition:all .25s;padding:16px}
.modal-overlay.open{opacity:1;visibility:visible}
.modal{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;width:100%;max-width:560px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;transform:scale(.95) translateY(20px);transition:transform .25s}
.modal-overlay.open .modal{transform:scale(1) translateY(0)}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid var(--border-color);background:var(--bg-secondary)}
.modal-title{font-size:18px;font-weight:600;color:var(--text-primary)}
.modal-close{width:36px;height:36px;border:none;background:var(--bg-tertiary);color:var(--text-secondary);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s}
.modal-close:hover{background:var(--bg-hover);color:var(--accent-danger)}
.modal-body{flex:1;overflow:auto;padding:24px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:600px){.form-grid{grid-template-columns:1fr}}
.form-group{display:flex;flex-direction:column;gap:6px}
.form-group label{font-size:12px;font-weight:600;color:var(--text-secondary)}
.senha-temporaria{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:8px;padding:12px;margin:16px 0;font-size:13px;color:#064e3b}
.modal-actions{display:flex;justify-content:flex-end;gap:12px;margin-top:24px;padding-top:16px;border-top:1px solid var(--border-color)}
</style>