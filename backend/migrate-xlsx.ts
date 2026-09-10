import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { passwordPolicy } from './src/utils/tokens'
import { normalizarNomeEscola, getMapaTecnicos } from './src/services/normalization'
import * as XLSX from 'xlsx'

const BCRYPT_COST = 12
const XLSX_PATH = join(process.cwd(), '..', 'database', 'Teste em branco (respostas) (4).xlsx')

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } }
})

function excelSerialToDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400 * 1000))
}

function toDate(v: unknown): Date {
  if (typeof v === 'number') return excelSerialToDate(v)
  if (v instanceof Date && !isNaN(v.getTime())) return v
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

function str(v: unknown): string {
  return String(v ?? '').trim()
}

function normalizar(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

const NIVEL_MAP: Record<string, string> = {
  'matriz': 'ADMIN',
  'tecnico': 'TECNICO',
  'filial': 'GESTOR',
  'adminfilial': 'GESTOR'
}

const STATUS_CHAMADO_MAP: Record<string, string> = {
  'aberto': 'ABERTO',
  'em andamento': 'ANDAMENTO',
  'andamento': 'ANDAMENTO',
  'comunicado': 'COMUNICADO',
  'resolvido': 'RESOLVIDO'
}

function normalizeKey(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function chamadoKey(solicitante: unknown, tipo: unknown, descricao: unknown): string {
  return `${normalizar(solicitante)}|${normalizar(tipo)}|${normalizar(descricao)}`
}

async function migrateUsuarios(rows: any[]) {
  console.log('📋 Migrando usuários...')
  let criados = 0
  for (const row of rows) {
    const email = str(row['email']).toLowerCase()
    if (!email || !email.includes('@') || email === 'e-mail da escola') continue

    const nome = str(row['nome'])
    const nivelRaw = normalizeKey(str(row['nivel']))
    const nivel = NIVEL_MAP[nivelRaw] || 'VISUALIZADOR'
    const filial = str(row['filial'])
    const statusRaw = normalizeKey(str(row['status']))
    const status = statusRaw === 'ativo' || statusRaw === '' ? 'ATIVO' : 'INATIVO'

    const existing = await prisma.usuario.findUnique({ where: { email } })
    if (existing) { console.log(`  ⏭️  já existe: ${email}`); continue }

    const senhaTemporaria = passwordPolicy.generateTemp()
    const senhaHash = await bcrypt.hash(senhaTemporaria, BCRYPT_COST)

    await prisma.usuario.create({
      data: { email, nome, nivel, filial, status, senhaHash, primeiroLogin: true }
    })
    console.log(`  ✅ ${email} (${nivel}) | Senha temp: ${senhaTemporaria}`)
    criados++
  }
  console.log(`  Total: ${criados} usuários criados`)
}

async function migrateEquipamentos(rows: any[]) {
  console.log('💻 Migrando equipamentos...')
  const dados: any[] = []
  for (const row of rows) {
    const categoria = str(row['category'] || row['categoria'])
    const marca = str(row['brand'] || row['marca'])
    const modelo = str(row['model'] || row['modelo'])
    if (!categoria || !marca || !modelo) continue
    dados.push({ categoria, marca, modelo })
  }
  const r = await prisma.equipamento.createMany({ data: dados, skipDuplicates: true })
  console.log(`  Total: ${r.count} equipamentos migrados`)
}

async function migrateChamados(chamadosRows: any[], respostasRows: any[]) {
  console.log('🎫 Migrando chamados...')
  const mapaTecnicos = getMapaTecnicos()

  // 1. Enriquecidos (aba "Chamados"): mapa chave -> dados de status/histórico
  const enriquecidos = new Map<string, any>()
  for (const row of chamadosRows) {
    const protocolo = str(row['ID'])
    const unidade = str(row['Unidade'])
    if (!protocolo || !unidade) continue
    const k = chamadoKey(row['Solicitante'], row['Tipo'], row['Descrição'])
    enriquecidos.set(k, { ...row, protocolo, unidade })
  }

  // 2. Fonte de verdade: respostas do Forms (aba "Respostas ao formulário 1")
  const mapaRespostas = new Map<string, any>()
  const ordem: string[] = []
  for (const row of respostasRows) {
    const unidade = str(row['UNIDADE ESCOLAR'])
    if (!unidade) continue
    const k = chamadoKey(row['Nome do solicitante'], row['Tipo de Solicitação'], row['Descrição do Problema'])
    if (!mapaRespostas.has(k)) {
      mapaRespostas.set(k, row)
      ordem.push(k)
    }
  }

  // 3. Gerar protocolos únicos para os que não vieram da aba "Chamados"
  const usados = new Set(enriquecidos.values ? [...enriquecidos.values()].map((e: any) => e.protocolo) : [])
  function gerarProtocolo(ts: Date): string {
    const ymd = ts.toISOString().slice(0, 10).replace(/-/g, '')
    let seq = 1
    let p = `CH-${ymd}-${String(seq).padStart(4, '0')}`
    while (usados.has(p)) { seq++; p = `CH-${ymd}-${String(seq).padStart(4, '0')}` }
    usados.add(p)
    return p
  }

  const dados: any[] = []
  for (const k of ordem) {
    const resp = mapaRespostas.get(k)
    const enc = enriquecidos.get(k)

    const unidade = str(resp['UNIDADE ESCOLAR'])
    const timestamp = toDate(resp['Carimbo de data/hora'])
    const escolaNorm = normalizarNomeEscola(unidade)
    const tecnicoSetor = mapaTecnicos[escolaNorm] || ''

    let protocolo: string
    let status: string
    let responsavel: string | null = null
    let historico: string | null = null
    let tecnicoResolucao: string | null = null
    let ultimaAtualizacao: Date
    let solicitante: string
    let funcao: string | null
    let tipo: string
    let descricao: string
    let urgencia: string
    let anexoUrl: string | null

    if (enc) {
      // dados enriquecidos da aba "Chamados"
      protocolo = enc.protocolo
      const statusRaw = normalizeKey(str(enc['Status']))
      status = STATUS_CHAMADO_MAP[statusRaw] || 'ABERTO'
      responsavel = str(enc['Responsável']) || null
      historico = str(enc['Histórico']) || null
      tecnicoResolucao = str(enc['Técnico Resolução']) || null
      ultimaAtualizacao = toDate(enc['Última Atualização'])
      solicitante = str(enc['Solicitante'])
      funcao = str(enc['Função']) || null
      tipo = str(enc['Tipo'])
      descricao = str(enc['Descrição'])
      urgencia = str(enc['Urgência'])
      anexoUrl = str(enc['Anexo']) || null
    } else {
      // resposta bruta sem chamado processado
      protocolo = gerarProtocolo(timestamp)
      status = 'ABERTO'
      ultimaAtualizacao = timestamp
      solicitante = str(resp['Nome do solicitante'])
      funcao = str(resp['2- Função']) || null
      tipo = str(resp['Tipo de Solicitação'])
      descricao = str(resp['Descrição do Problema'])
      urgencia = str(resp['Urgência'])
      anexoUrl = str(resp['Anexos'] || resp['Anexos.  \nFotos ou prints do problema.']) || null
    }

    dados.push({
      protocolo,
      timestamp,
      unidade,
      solicitante,
      funcao,
      tipo,
      descricao,
      urgencia,
      anexoUrl,
      status,
      responsavel,
      ultimaAtualizacao,
      historico,
      tecnicoResolucao,
      tecnicoSetor
    })
  }

  let total = 0
  for (let i = 0; i < dados.length; i += 100) {
    const chunk = dados.slice(i, i + 100)
    const r = await prisma.chamado.createMany({ data: chunk, skipDuplicates: true })
    total += r.count
  }
  console.log(`  Total: ${total} chamados (${dados.length} processados, ${enriquecidos.size} enriquecidos)`)
}

async function main() {
  console.log('🚀 Iniciando migração XLSX → Supabase...')
  console.log(`   Arquivo: ${XLSX_PATH}`)

  const wb = XLSX.readFile(XLSX_PATH)
  const usuariosRows = XLSX.utils.sheet_to_json(wb.Sheets['Usuarios'])
  const equipamentosRows = XLSX.utils.sheet_to_json(wb.Sheets['Equipamentos'])
  const chamadosRows = XLSX.utils.sheet_to_json(wb.Sheets['Chamados'])
  const respostasRows = XLSX.utils.sheet_to_json(wb.Sheets['Respostas ao formulário 1'])

  await migrateUsuarios(usuariosRows)
  await migrateEquipamentos(equipamentosRows)
  await prisma.chamado.deleteMany({})
  await migrateChamados(chamadosRows, respostasRows)

  console.log('✅ Migração concluída!')
}

main()
  .catch(e => { console.error('❌ Erro na migração:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())