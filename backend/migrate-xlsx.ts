import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { passwordPolicy } from './src/utils/tokens'
import { normalizarNomeEscola, getMapaTecnicos } from './src/services/normalization'
import * as XLSX from 'xlsx'

const BCRYPT_COST = 12
const XLSX_PATH = join(process.cwd(), '..', 'database', 'Teste em branco (respostas) (5).xlsx')

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

// Colunas da aba "Chamados" (posicional, pois a coluna de ID está sem rótulo):
// [0] ID, [1] Timestamp, [2] Unidade, [3] Solicitante, [4] Função, [5] Tipo,
// [6] Descrição, [7] Urgência, [8] Anexo, [9] Status, [10] Responsável,
// [11] Última Atualização, [12] Histórico, [13] Técnico Resolução, [14] Email
async function migrateChamados(rows: any[][]) {
  console.log('🎫 Migrando chamados (aba Chamados)...')
  const mapaTecnicos = getMapaTecnicos()

  const dados: any[] = []
  for (const row of rows) {
    const protocolo = str(row[0])
    if (!protocolo) continue

    const unidade = str(row[2])
    const escolaNorm = normalizarNomeEscola(unidade)
    const tecnicoSetor = mapaTecnicos[escolaNorm] || ''

    const statusRaw = normalizeKey(str(row[9]))
    const status = STATUS_CHAMADO_MAP[statusRaw] || 'ABERTO'

    dados.push({
      protocolo,
      timestamp: toDate(row[1]),
      unidade,
      solicitante: str(row[3]),
      funcao: str(row[4]) || null,
      tipo: str(row[5]),
      descricao: str(row[6]),
      urgencia: str(row[7]),
      anexoUrl: str(row[8]) || null,
      status,
      responsavel: str(row[10]) || null,
      ultimaAtualizacao: toDate(row[11]),
      historico: str(row[12]) || null,
      tecnicoResolucao: str(row[13]) || null,
      tecnicoSetor
    })
  }

  let total = 0
  for (let i = 0; i < dados.length; i += 100) {
    const chunk = dados.slice(i, i + 100)
    const r = await prisma.chamado.createMany({ data: chunk, skipDuplicates: true })
    total += r.count
  }
  console.log(`  Total: ${total} chamados migrados (${dados.length} processados)`)
}

async function main() {
  console.log('🚀 Iniciando migração XLSX → Supabase...')
  console.log(`   Arquivo: ${XLSX_PATH}`)

  const wb = XLSX.readFile(XLSX_PATH)

  const usuariosRows = XLSX.utils.sheet_to_json(wb.Sheets['Usuarios'])
  const equipamentosRows = XLSX.utils.sheet_to_json(wb.Sheets['Equipamentos'])
  const chamadosAoa = XLSX.utils.sheet_to_json(wb.Sheets['Chamados'], { header: 1, defval: '' })

  // descarta a linha de cabeçalho
  const chamadosRows = chamadosAoa.slice(1) as any[][]

  await migrateUsuarios(usuariosRows)
  await migrateEquipamentos(equipamentosRows)
  await prisma.chamado.deleteMany({})
  await migrateChamados(chamadosRows)

  console.log('✅ Migração concluída!')
}

main()
  .catch(e => { console.error('❌ Erro na migração:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())