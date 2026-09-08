<template>
  <div class="forms-app">
    <header class="topbar">
      <img src="https://i.ibb.co/3yBdJq67/IMG-9095.png" alt="Logo URE" width="50" height="50" class="topbar-logo" />
      <div class="topbar-org">
        <small>Governo do Estado de São Paulo</small>
        <strong>Atende Leste 3 — Unidade Regional de Ensino Leste 3</strong>
      </div>
    </header>

    <main class="forms-main">
      <section v-show="currentView === 'home'" class="view active">
        <p class="eyebrow">Central de Atendimento — SETEC</p>
        <h1 class="hero">Como podemos ajudar?</h1>
        <p class="hero-sub">Selecione o tipo de problema abaixo. O chamado será encaminhado automaticamente à equipe do SETEC.</p>

        <div class="grid-cat">
          <button v-for="cat in categories" :key="cat.id" type="button" class="card-cat" :style="{ '--cor-cat': cat.cor }" @click="abrirCat(cat.id)">
            <svg class="cat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8 15.5a6 6 0 0 1 8 0"/><circle cx="12" cy="19" r=".8" fill="currentColor" stroke="none"/></svg>
            <h3>{{ cat.titulo }}</h3>
            <p>{{ cat.desc }}</p>
            <span class="lnk">Abrir chamado →</span>
          </button>
        </div>

        <div class="contato">
          <div>
            <h4>Fale com o SETEC</h4>
            <p>{{ contato.nome }}</p>
            <p class="sub">{{ contato.unidade }} · {{ contato.telefone }} · {{ contato.email }}</p>
          </div>
        </div>
      </section>

      <section v-show="currentView === 'questions'" class="view active">
        <div class="fheader">
          <Button variant="ghost" size="sm" @click="voltarHome" class="voltar-btn">← Voltar</Button>
          <span class="badge" :style="{ background: activeCategory?.cor + '20', color: activeCategory?.cor }">{{ activeCategory?.titulo }}</span>
        </div>
        <h2 class="vtitulo">{{ activeCategory?.titulo }}</h2>
        <p class="vsub">Responda as perguntas para detalhar o chamado.</p>

        <div v-if="activeCategory?.id === 'rede'" class="cat-qs">
          <Card class="qb">
            <h3 class="qt">Qual é o problema de rede?</h3>
            <div class="ops">
              <button v-for="opt in redeOptions" :key="opt.value" type="button" class="op" :class="{ sel: form.rede === opt.value }" @click="form.rede = opt.value"><span class="radio" :class="{ sel: form.rede === opt.value }"></span>{{ opt.label }}</button>
            </div>
          </Card>
          <div v-if="form.rede === 'lentidao'" class="qb">
            <h3 class="qt">Teste de velocidade</h3>
            <div class="al al-info"><div><p>Antes de abrir o chamado, faça o <strong>teste de velocidade</strong> da internet da escola.</p><p>Após o teste, <strong>tire uma print do resultado</strong> e anexe ao chamado na próxima etapa.</p><Button variant="primary" @click="abrirTeste" class="btn-al"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Fazer Teste de Velocidade</Button></div></div>
          </div>
          <div v-if="form.rede === 'queda-total'" class="qb">
            <h3 class="qt">A escola possui energia elétrica agora?</h3>
            <div class="ops"><button type="button" class="op" :class="{ sel: form.energia === 'sim' }" @click="form.energia = 'sim'"><span class="radio"></span>Sim, há energia na escola</button><button type="button" class="op" :class="{ sel: form.energia === 'nao' }" @click="form.energia = 'nao'"><span class="radio"></span>Não, está sem energia no momento</button></div>
            <div v-if="form.energia === 'nao'" class="al al-aviso"><p><strong>Aguarde o retorno da energia.</strong></p><p>A rede se estabiliza automaticamente quando a energia voltar.</p><Button variant="ghost" @click="voltarHome" class="btn-al out">← Voltar ao início</Button></div>
          </div>
          <div v-if="form.rede === 'wifi-salas'" class="qb"><h3 class="qt">Quais salas ou locais estão sem conexão?</h3><p class="qs">Detalhe os locais afetados para agilizar o atendimento.</p><textarea class="locais-ta" v-model="form.locais" placeholder="Ex.: Sala 5, Sala 7, Quadra, Laboratório de Informática, Secretaria..."></textarea></div>
          <div v-if="form.rede === 'pontos'" class="qb"><h3 class="qt">Pontos de Rede — Anexo obrigatório</h3><div class="al al-aviso"><p>Para solicitações de novos pontos de rede, é <strong>obrigatório</strong> anexar <strong>fotos das salas e locais</strong> onde os pontos são necessários.</p></div></div>
          <Button v-if="podeAvancarRede" variant="primary" size="lg" class="btn-av" @click="irParaId">Continuar →</Button>
        </div>

        <div v-if="activeCategory?.id === 'equip'" class="cat-qs">
          <Card class="qb"><h3 class="qt">Qual é o tipo de problema no equipamento?</h3><div class="ops"><button v-for="opt in equipOptions" :key="opt.value" type="button" class="op" :class="{ sel: form.equip === opt.value }" @click="form.equip = opt.value"><span class="radio"></span>{{ opt.label }}</button></div></Card>
          <div v-if="form.equip && form.equip !== 'wifi' && form.equip !== 'sistema'" class="qb">
            <h3 class="qt">Selecione o equipamento</h3>
            <div class="excs">
              <div class="exc"><label>Categoria *</label><Select id="equip-categoria" v-model="form.categoria" :options="categoriasEquip" placeholder="— Selecione a categoria —" :disabled="!categoriasEquip.length" @update:modelValue="onCategoriaChange" /></div>
              <div class="exc"><label>Marca *</label><Select id="equip-marca" v-model="form.marca" :options="marcasEquip" placeholder="— Selecione a marca —" :disabled="!marcasEquip.length" @update:modelValue="onMarcaChange" /></div>
              <div class="exc"><label>Modelo *</label><Select id="equip-modelo" v-model="form.modelo" :options="modelosEquip" placeholder="— Selecione o modelo —" :disabled="!modelosEquip.length" @update:modelValue="onModeloSelect" /></div>
            </div>
            <div v-if="equipSelecionado" class="al al-ok"><p>Equipamento: <strong>{{ equipSelecionado.categoria }} / {{ equipSelecionado.marca }} / {{ equipSelecionado.modelo }}</strong></p></div>
          </div>
          <div v-if="form.equip === 'fisico'" class="qb"><h3 class="qt">Qual é o tipo de problema físico?</h3><div class="tfgrid"><button v-for="opt in fisicoOptions" :key="opt" type="button" class="tfbtn" :class="{ sel: form.tipoFisico === opt }" @click="form.tipoFisico = opt">{{ opt }}</button></div></div>
          <Button v-if="podeAvancarEquip" variant="primary" size="lg" class="btn-av" @click="irParaId">Continuar →</Button>
        </div>

        <div v-if="activeCategory?.id === 'sistema'" class="cat-qs">
          <Card class="qb"><h3 class="qt">Qual sistema está com problema?</h3><Select id="form-sistema" v-model="form.sistema" :options="sistemaOptions" placeholder="— Selecione o sistema —" @update:modelValue="onSistemaChange" /></Card>
          <div v-if="form.sistema === 'PortalNet'" class="qb"><h3 class="qt">Informações para o PortalNet</h3><div class="excs"><div class="exc"><label>RG *</label><Input v-model="form.pnRg" placeholder="Número do RG" /></div><div class="exc"><label>Nome completo *</label><Input v-model="form.pnNome" placeholder="Nome completo do servidor" /></div><div class="exc"><label>Atribuições / Transferência *</label><Input v-model="form.pnAtrib" placeholder="Ex.: Transferir de E.E. X para E.E. Y — atribuição de Coordenador Pedagógico..." /></div></div></div>
          <Button v-if="podeAvancarSistema" variant="primary" size="lg" class="btn-av" @click="irParaId">Continuar →</Button>
        </div>

        <div v-if="activeCategory?.id === 'email'" class="cat-qs">
          <Card class="qb"><h3 class="qt">Informações para o chamado de e-mail</h3><p class="qs">Todos os campos são obrigatórios para processar o chamado.</p><div class="al al-info"><p>Chamados de e-mail <strong>sem estas informações não poderão ser processados</strong>. Preencha com atenção.</p></div><div class="excs"><div class="exc"><label>CIE *</label><Input v-model="form.emCie" placeholder="Código CIE da escola" /></div><div class="exc"><label>Nome da Escola / Diretoria *</label><Input v-model="form.emEscola" placeholder="Ex.: E.E. Nome da Escola / DE Leste 3" /></div><div class="exc"><label>Login *</label><Input v-model="form.emLogin" placeholder="Login do usuário (sem @educacao.sp.gov.br)" /></div><div class="exc"><label>E-mail *</label><Input v-model="form.emEmail" type="email" placeholder="login@educacao.sp.gov.br" /></div></div></Card>
          <Button variant="primary" size="lg" class="btn-av" @click="irParaId">Continuar →</Button>
        </div>
      </section>

      <section v-show="currentView === 'id'" class="view active">
        <div class="fheader"><Button variant="ghost" size="sm" @click="voltarQ" class="voltar-btn">← Voltar</Button><span class="badge" :style="{ background: activeCategory?.cor + '20', color: activeCategory?.cor }">Identificação</span></div>
        <h2 class="vtitulo">Identificação</h2>
        <p class="vsub">Informe seus dados para concluir o chamado.</p>
        <div class="resumo"><span v-for="tag in resumoTags" :key="tag" class="tag">{{ tag }}</span></div>
        <Card class="cartao">
          <div class="campo"><label for="id-nome">Nome completo *</label><Input id="id-nome" v-model="form.nome" placeholder="Seu nome completo" :error="errors.nome" /></div>
          <div class="l2"><div class="campo"><label for="id-cargo">Cargo / Função *</label><Select id="id-cargo" v-model="form.cargo" :options="cargoOptions" placeholder="— Cargo —" :error="errors.cargo" /></div><div class="campo"><label for="id-email">E-mail institucional *</label><Input id="id-email" v-model="form.email" type="email" placeholder="nome@educacao.sp.gov.br" :error="errors.email" /></div></div>
          <div class="campo"><label for="id-escola">Escola / Unidade *</label><Select id="id-escola" v-model="form.escola" :options="escolaOptions" placeholder="— Escola —" :error="errors.escola" /></div>
        </Card>
        <Card class="cartao">
          <div class="campo"><label for="id-desc">Descrição adicional <span class="opc">(opcional)</span></label><textarea id="id-desc" v-model="form.descAdicional" placeholder="Adicione qualquer informação que possa ajudar na resolução..." rows="4"></textarea></div>
          <div class="campo"><label>Urgência *</label><div class="urgs"><button v-for="u in urgenciaOptions" :key="u" type="button" class="urg" :class="{ sel: form.urgencia === u }" @click="form.urgencia = u">{{ u }}</button></div><p v-if="errors.urgencia" class="etxt">{{ errors.urgencia }}</p></div>
          <div class="campo"><label for="id-anexo">Anexo <span class="opc">(opcional — print ou foto do problema)</span></label><input id="id-anexo" type="file" accept="image/*,.pdf" @change="handleAnexo" /><p v-if="errors.anexo" class="etxt">{{ errors.anexo }}</p></div>
        </Card>
        <div class="acoes"><Button variant="secondary" @click="voltarQ">← Voltar</Button><Button variant="primary" @click="enviar" :loading="submitting">Enviar chamado</Button></div>
      </section>

      <section v-show="currentView === 'success'" class="view active"><div class="suc"><div class="selo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12l5 5L20 6"/></svg></div><h2>Chamado registrado!</h2><p>Seu protocolo é:</p><div class="protocolo">{{ protocolo }}</div><p>Guarde este número. A equipe do SETEC foi notificada e entrará em contato.</p><Button variant="primary" @click="voltarHome" class="btn-av">Abrir outro chamado</Button></div></section>

      <div class="modal-overlay" :class="{ aberto: modalTesteAberto }" @click.self="fecharTeste"><div class="modal-box"><div class="modal-topo"><div class="modal-topo-info"><strong>🌐 Teste de Velocidade</strong><small>Ao terminar, tire um print do resultado e feche esta janela</small></div><button class="modal-fechar" @click="fecharTeste">✕</button></div><iframe :src="testeUrl" loading="lazy" allow="fullscreen"></iframe></div></div>
    </main>
    <footer>SETEC · Unidade Regional de Ensino Leste 3 · Governo do Estado de São Paulo</footer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChamadosStore } from '@/stores/chamados'
import { useUIStore } from '@/stores/ui'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const chamados = useChamadosStore()
const ui = useUIStore()

const currentView = ref<'home'|'questions'|'id'|'success'>('home')
const activeCategory = ref<any>(null)
const modalTesteAberto = ref(false)
const testeUrl = 'https://www.brasilbandalarga.com.br/'
const protocolo = ref('')

const categories = [{id:'rede',cor:'#1E7FC7',titulo:'Problema de Rede',desc:'Lentidão, queda de internet, Wi-Fi instável ou solicitação de pontos de rede.'},{id:'equip',cor:'#1E7A4C',titulo:'Problema de Equipamento',desc:'Notebook, tablet ou impressora com problema físico, de software, Wi-Fi ou formatação.'},{id:'sistema',cor:'#7A4FB5',titulo:'Problema em Sistema',desc:'Erros em sistemas como PortalNet e outros sistemas educacionais.'},{id:'email',cor:'#C9711A',titulo:'Problema no E-mail',desc:'Sem acesso, senha bloqueada ou problemas de login.'}]
const redeOptions = [{value:'lentidao',label:'Lentidão'},{value:'queda-total',label:'Queda total de internet'},{value:'wifi-salas',label:'Queda de Wi-Fi em salas ou locais específicos'},{value:'pontos',label:'Solicitação de Pontos de Rede'}]
const equipOptions = [{value:'wifi',label:'Wi-Fi (equipamento não conecta à rede)'},{value:'fisico',label:'Manutenção — Problemas Físicos'},{value:'software',label:'Manutenção — Problemas de Software'},{value:'formatacao',label:'Formatação'},{value:'sistema',label:'Sistema (login, configuração, perfil)'}]
const fisicoOptions = ['Bateria','Teclado','Tela','Som','Câmera','Outro']
const sistemaOptions = [{value:'PortalNet',label:'PortalNet'}]
const cargoOptions = [{value:'Diretor',label:'Diretor'},{value:'Vice-diretor',label:'Vice-diretor'},{value:'Coordenador',label:'Coordenador'},{value:'Gerente de Organização Escolar',label:'Gerente de Organização Escolar'},{value:'Agente de Organização Escolar',label:'Agente de Organização Escolar'},{value:'Professor',label:'Professor'},{value:'Estagiário (Proati)',label:'Estagiário (Proati)'}]
const escolaOptions = [{value:'E.E. ADHEMAR ANTONIO PRADO',label:'E.E. ADHEMAR ANTONIO PRADO'},{value:'E.E. ALCIDES BOSCOLO',label:'E.E. ALCIDES BOSCOLO'}]
const urgenciaOptions = ['Baixa','Média','Alta']
const contato = {nome:'Jessica Moraes - Chefe de Seção SETEC',unidade:'URE Leste 3',telefone:'(11) 2523-7010',email:'lt3.setec@educacao.sp.gov.br'}

const form = reactive({rede:'',energia:'',locais:'',equip:'',categoria:'',marca:'',modelo:'',tipoFisico:'',sistema:'',pnRg:'',pnNome:'',pnAtrib:'',emCie:'',emEscola:'',emLogin:'',emEmail:'',nome:'',cargo:'',email:'',escola:'',descAdicional:'',urgencia:'',anexo:null as File|null})
const errors = reactive({nome:'',cargo:'',email:'',escola:'',urgencia:'',anexo:''})
const categoriasEquip = ref<Array<{value: string, label: string}>>([])
const marcasEquip = ref<Array<{value: string, label: string}>>([])
const modelosEquip = ref<Array<{value: string, label: string}>>([])
let equipSelecionado: any = null
let submitting = false

async function loadCategorias() {
  try {
    const res = await fetch('/api/equipamentos/categorias', { cache: 'no-cache' })
    const data = await res.json()
    categoriasEquip.value = data.map((c: string) => ({ value: c, label: c }))
  } catch (e) {
    console.error('Erro ao carregar categorias:', e)
    categoriasEquip.value = ['Notebook','Tablet','Impressora'].map(c => ({ value: c, label: c }))
  }
}

async function onCategoriaChange() {
  form.marca = ''
  form.modelo = ''
  marcasEquip.value = []
  modelosEquip.value = []
  equipSelecionado = null
  if (!form.categoria) return
  try {
    const res = await fetch(`/api/equipamentos/marcas?categoria=${encodeURIComponent(form.categoria)}`, { cache: 'no-cache' })
    const data = await res.json()
    marcasEquip.value = data.map((m: string) => ({ value: m, label: m }))
  } catch (e) {
    console.error('Erro ao carregar marcas:', e)
  }
}

async function onMarcaChange() {
  form.modelo = ''
  modelosEquip.value = []
  equipSelecionado = null
  if (!form.categoria || !form.marca) return
  try {
    const res = await fetch(`/api/equipamentos/modelos?categoria=${encodeURIComponent(form.categoria)}&marca=${encodeURIComponent(form.marca)}`, { cache: 'no-cache' })
    const data = await res.json()
    modelosEquip.value = data.map((m: string) => ({ value: m, label: m }))
  } catch (e) {
    console.error('Erro ao carregar modelos:', e)
  }
}

function onModeloSelect() {
  equipSelecionado = { categoria: form.categoria, marca: form.marca, modelo: form.modelo }
}

onMounted(async() => {
  await loadCategorias()
})

function abrirCat(id:string){activeCategory.value=categories.find(c=>c.id===id)||null;currentView.value='questions'}
function voltarHome(){currentView.value='home';activeCategory.value=null;resetForm()}
function voltarQ(){currentView.value='questions'}

const podeAvancarRede=computed(()=>{if(!form.rede)return false;if(form.rede==='lentidao')return true;if(form.rede==='queda-total')return!!form.energia;if(form.rede==='wifi-salas')return form.locais.trim().length>0;if(form.rede==='pontos')return true;return false})

const podeAvancarEquip=computed(()=>{if(!form.equip)return false;if(form.equip==='wifi'||form.equip==='sistema')return true;return!!form.modelo})
const podeAvancarSistema=computed(()=>{if(!form.sistema)return false;if(form.sistema!=='PortalNet')return true;return!!form.pnRg&&!!form.pnNome&&!!form.pnAtrib})

function irParaId(){currentView.value='id'}

const resumoTags=computed(()=>{const tags:string[]=[];if(activeCategory.value)tags.push(activeCategory.value.titulo);if(form.rede)tags.push(form.rede);if(form.equip)tags.push(form.equip);if(form.sistema)tags.push(form.sistema);return tags})

function handleAnexo(e:Event){const t=e.target as HTMLInputElement;if(t.files&&t.files[0]){form.anexo=t.files[0];errors.anexo=''}}

async function enviar(){errors.nome=form.nome?'':'Informe seu nome';errors.cargo=form.cargo?'':'Selecione seu cargo';errors.email=form.email&&form.email.includes('@')?'':'E-mail inválido';errors.escola=form.escola?'':'Selecione a escola';errors.urgencia=form.urgencia?'':'Selecione a urgência';if(errors.nome||errors.cargo||errors.email||errors.escola||errors.urgencia)return;submitting=true;try{const anexoBase64=form.anexo?await fileToBase64(form.anexo):undefined;const result=await chamados.criar({unidade:form.escola,solicitante:form.nome,funcao:form.cargo,tipo:activeCategory.value?.titulo||'Outro',descricao:form.descAdicional||buildDescricao(),urgencia:form.urgencia,anexoBase64,anexoNome:form.anexo?.name,anexoTipo:form.anexo?.type});protocolo.value=result.protocolo;currentView.value='success'}catch(err:any){ui.showToast('error',err.response?.data?.message||'Erro ao enviar chamado')}finally{submitting=false}}

function buildDescricao(){const parts:string[]=[];if(form.rede)parts.push(`Rede: ${form.rede}`);if(form.energia)parts.push(`Energia: ${form.energia}`);if(form.locais)parts.push(`Locais: ${form.locais}`);if(form.equip)parts.push(`Equip: ${form.equip}`);if(form.tipoFisico)parts.push(`Físico: ${form.tipoFisico}`);if(form.sistema)parts.push(`Sistema: ${form.sistema}`);if(form.pnRg)parts.push(`RG: ${form.pnRg}`);if(form.pnNome)parts.push(`Nome: ${form.pnNome}`);if(form.pnAtrib)parts.push(`Atrib: ${form.pnAtrib}`);if(form.emCie)parts.push(`CIE: ${form.emCie}`);if(form.emEscola)parts.push(`Esc: ${form.emEscola}`);if(form.emLogin)parts.push(`Login: ${form.emLogin}`);if(form.emEmail)parts.push(`Email: ${form.emEmail}`);if(form.categoria)parts.push(`Cat: ${form.categoria}`);if(form.marca)parts.push(`Marca: ${form.marca}`);if(form.modelo)parts.push(`Mod: ${form.modelo}`);return parts.join(' | ')}

function fileToBase64(file:File):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve((reader.result as string).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)})}

function resetForm(){Object.keys(form).forEach(k=>(form as any)[k]='');form.anexo=null;Object.keys(errors).forEach(k=>errors[k as keyof typeof errors]='')}

function abrirTeste(){modalTesteAberto.value=true}
function fecharTeste(){modalTesteAberto.value=false}
</script>

<style scoped>
/* Core styles - full CSS moved to main.css */
.forms-app { min-height: 100vh; display: flex; flex-direction: column; }
.topbar { background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); padding: 14px 20px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 100; }
.topbar-logo { flex-shrink: 0; }
.topbar-org { display: flex; flex-direction: column; line-height: 1.2; }
.topbar-org small { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; }
.topbar-org strong { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.forms-main { flex: 1; width: 100%; max-width: 720px; margin: 0 auto; padding: 28px 20px 60px; }
.view { display: none; }
.view.active { display: block; animation: subir .25s ease both; }
@keyframes subir { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
.eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--accent-primary); margin: 0 0 6px; }
.hero { font-size: 28px; font-weight: 800; margin: 0 0 8px; letter-spacing: -.01em; }
.hero-sub { font-size: 14.5px; color: var(--text-secondary); margin: 0 0 26px; max-width: 52ch; }
.grid-cat { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 28px; }
@media (max-width: 520px) { .grid-cat { grid-template-columns: 1fr; } }
.card-cat { text-align: left; background: var(--bg-card); border: 1px solid var(--border-color); border-left: 4px solid var(--cor-cat); border-radius: 14px; padding: 18px; cursor: pointer; box-shadow: var(--shadow-sm); transition: transform .13s, box-shadow .13s; display: flex; flex-direction: column; gap: 7px; font-family: inherit; color: inherit; }
.card-cat:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.card-cat .cat-icon { width: 24px; height: 24px; color: var(--cor-cat); }
.card-cat h3 { margin: 0; font-size: 15px; font-weight: 700; }
.card-cat p { margin: 0; font-size: 12.5px; color: var(--text-secondary); }
.card-cat .lnk { font-size: 12.5px; font-weight: 700; color: var(--cor-cat); margin-top: 4px; }
.contato { background: var(--accent-primary); color: white; border-radius: 14px; padding: 18px 20px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 14px; align-items: center; }
.contato h4 { margin: 0 0 2px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: rgba(255,255,255,.7); font-weight: 700; }
.contato p { margin: 0; font-size: 14px; font-weight: 600; }
.contato .sub { font-size: 12px; font-weight: 400; color: rgba(255,255,255,.8); margin-top: 2px; }
.fheader { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.voltar-btn { color: var(--accent-primary); }
.badge { padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.vtitulo { font-size: 20px; font-weight: 800; margin: 0 0 4px; }
.vsub { font-size: 13.5px; color: var(--text-secondary); margin: 0 0 20px; }
.qb { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; padding: 20px; margin-bottom: 12px; }
.qt { font-size: 14.5px; font-weight: 700; margin: 0 0 12px; }
.qs { font-size: 13px; color: var(--text-secondary); margin: -8px 0 12px; }
.ops { display: flex; flex-direction: column; gap: 8px; }
.op { display: flex; align-items: center; gap: 10px; background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 8px; padding: 11px 14px; cursor: pointer; font-family: inherit; font-size: 13.5px; font-weight: 600; color: var(--text-primary); text-align: left; transition: border-color .1s, background .1s; width: 100%; }
.op:hover { border-color: var(--accent-primary); background: rgba(59,130,246,.1); }
.op.sel { border-color: var(--accent-primary); background: rgba(59,130,246,.15); }
.radio { width: 17px; height: 17px; border-radius: 50%; border: 2px solid var(--border-color); flex: none; display: flex; align-items: center; justify-content: center; background: var(--bg-card); transition: all .1s; }
.op.sel .radio { border-color: var(--accent-primary); background: var(--accent-primary); }
.op.sel .radio::after { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #fff; }
.al { border-radius: 8px; padding: 13px 15px; font-size: 13.5px; line-height: 1.55; display: flex; gap: 10px; align-items: flex-start; margin-top: 12px; }
.al p { margin: 0 0 6px; }
.al p:last-child { margin: 0; }
.al svg { flex-shrink: 0; margin-top: 2px; width: 18px; height: 18px; }
.al-info { background: rgba(59,130,246,.1); color: var(--accent-primary); border: 1px solid rgba(59,130,246,.2); }
.al-aviso { background: rgba(245,158,11,.1); color: var(--accent-warning); border: 1px solid rgba(245,158,11,.2); }
.al-ok { background: rgba(16,185,129,.1); color: var(--accent-secondary); border: 1px solid rgba(16,185,129,.2); }
.btn-al { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; padding: 9px 14px; background: var(--accent-primary); color: #fff; border: none; border-radius: 999px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }
.btn-al.out { background: none; color: var(--accent-primary); border: 1.5px solid var(--accent-primary); }
.btn-al.out:hover { background: rgba(59,130,246,.1); }
.excs { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.exc label { display: block; font-size: 12.5px; font-weight: 700; margin-bottom: 4px; }
.exc input, .exc textarea { width: 100%; border: 1.5px solid var(--border-color); border-radius: 8px; padding: 9px 12px; font-size: 13.5px; font-family: inherit; color: var(--text-primary); background: var(--bg-input); }
.exc input:focus, .exc textarea:focus { outline: none; border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(59,130,246,.2); }
.exc textarea { resize: vertical; min-height: 70px; }
.locais-ta { width: 100%; border: 1.5px solid var(--border-color); border-radius: 8px; padding: 10px 12px; font-size: 13.5px; font-family: inherit; color: var(--text-primary); resize: vertical; min-height: 70px; margin-top: 10px; }
.locais-ta:focus { outline: none; border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(59,130,246,.2); }
.tfgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
@media (max-width: 520px) { .tfgrid { grid-template-columns: repeat(2, 1fr); } }
.tfbtn { padding: 10px 6px; border: 1.5px solid var(--border-color); border-radius: 8px; background: var(--bg-card); cursor: pointer; font-family: inherit; font-size: 12.5px; font-weight: 700; color: var(--text-primary); text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.tfbtn:hover { border-color: var(--accent-primary); background: rgba(59,130,246,.1); }
.tfbtn.sel { border-color: var(--accent-primary); background: rgba(59,130,246,.15); color: var(--accent-primary); }
.btn-av { width: 100%; margin-top: 14px; padding: 13px; border: none; border-radius: 8px; background: var(--accent-primary); color: #fff; font-family: inherit; font-size: 14.5px; font-weight: 700; cursor: pointer; }
.btn-av:hover { filter: brightness(1.1); }
.resumo { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }
.tag { padding: 4px 12px; border-radius: 999px; background: var(--accent-primary); color: #fff; font-size: 12px; font-weight: 700; }
.cartao { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; padding: 22px; box-shadow: var(--shadow-sm); margin-bottom: 14px; }
.campo { margin-bottom: 16px; }
.campo label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 5px; }
.campo label .opc { font-weight: 400; color: var(--text-secondary); }
.campo input, .campo select, .campo textarea { width: 100%; border: 1.5px solid var(--border-color); border-radius: 8px; padding: 10px 12px; font-size: 14px; font-family: inherit; color: var(--text-primary); background: var(--bg-input); }
.campo input:focus, .campo select:focus, .campo textarea:focus { outline: none; border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(59,130,246,.2); }
.campo textarea { resize: vertical; min-height: 90px; }
.campo .etxt { display: none; color: var(--accent-danger); font-size: 12px; margin-top: 4px; font-weight: 600; }
.campo.inv input, .campo.inv select, .campo.inv textarea { border-color: var(--accent-danger); }
.campo.inv .etxt { display: block; }
.l2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 520px) { .l2 { grid-template-columns: 1fr; } }
.urgs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
@media (max-width: 520px) { .urgs { grid-template-columns: 1fr; } }
.urg { border: 1.5px solid var(--border-color); border-radius: 8px; padding: 10px; text-align: center; cursor: pointer; font-size: 13px; font-weight: 700; color: var(--text-secondary); font-family: inherit; background: var(--bg-card); }
.urg.sel { border-color: var(--accent-primary); background: rgba(59,130,246,.1); color: var(--accent-primary); }
.urg[data-v='Alta'].sel { border-color: var(--accent-danger); background: rgba(239,68,68,.1); color: var(--accent-danger); }
.urg[data-v='Média'].sel { border-color: var(--accent-warning); background: rgba(245,158,11,.1); color: var(--accent-warning); }
.urg[data-v='Baixa'].sel { border-color: var(--accent-secondary); background: rgba(16,185,129,.1); color: var(--accent-secondary); }
.acoes { display: flex; justify-content: space-between; align-items: center; margin-top: 22px; }
.acoes button { border: none; border-radius: 999px; padding: 12px 22px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; }
.btn--primary { background: var(--accent-primary); color: #fff; }
.btn--primary:hover { background: var(--accent-primary-hover); }
.btn--secondary { background: none; color: var(--accent-primary); border: 1.5px solid var(--border-color); }
.btn--secondary:hover { background: rgba(59,130,246,.1); }
.suc { text-align: center; padding: 44px 10px; }
.selo { width: 66px; height: 66px; border-radius: 50%; background: rgba(16,185,129,.1); color: var(--accent-secondary); display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; }
.selo svg { width: 30px; height: 30px; }
.suc h2 { font-size: 22px; margin: 0 0 8px; }
.suc p { color: var(--text-secondary); font-size: 14.5px; margin: 0 0 4px; }
.protocolo { display: inline-block; margin: 16px 0 24px; padding: 10px 20px; border-radius: 8px; background: var(--accent-primary); color: #fff; font-weight: 800; font-size: 20px; letter-spacing: .03em; }
.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 999; align-items: center; justify-content: center; padding: 16px; }
.modal-overlay.aberto { display: flex; }
.modal-box { background: var(--bg-card); border-radius: 14px; overflow: hidden; width: min(96vw, 860px); height: min(88vh, 580px); display: flex; flex-direction: column; box-shadow: var(--shadow-lg); animation: subir .22s ease both; }
.modal-topo { padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); background: var(--bg-secondary); flex: none; }
.modal-topo-info strong { font-size: 14px; font-weight: 700; display: block; }
.modal-topo-info small { font-size: 12px; color: var(--text-secondary); }
.modal-fechar { background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text-secondary); padding: 0 4px; line-height: 1; }
.modal-fechar:hover { color: var(--text-primary); }
.modal-box iframe { flex: 1; border: none; width: 100%; }
footer { text-align: center; padding: 16px; font-size: 12px; color: var(--text-secondary); border-top: 1px solid var(--border-color); background: var(--bg-secondary); }
</style> 
  
  
 