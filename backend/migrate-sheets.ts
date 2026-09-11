import { readFileSync } from 'fs'
import { join } from 'path'
import { google } from 'googleapis'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { passwordPolicy } from './src/utils/tokens'
import { normalizarNomeEscola, getMapaTecnicos } from './src/services/normalization'

const BCRYPT_COST = 12
const SHEET_ID = '1HyfNcETaINc0ZKcvM0pUPqlv94gwkNlYlwIpvCBxV8o'

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

async function getSheets() {
  const json = readFileSync(join(process.cwd(), 'gcp-service-account.json'), 'utf-8')
  const creds = JSON.parse(json)
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  })
  return google.sheets({ version: 'v4', auth })
}

async function readSheet(sheets: any, tab: string): Promise<any[][]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A:Z`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER'
  })
  return res.data.values || []
}

function toObjects(rows: any[][]) {
  const [header, ...data] = rows
  return data.map(row => {
    const obj: Record<string, any> = {}
    header.forEach((h, i) => {
      if (h !== undefined && h !== null && String(h).trim() !== '') obj[String(h).trim()] = row[i]
    })
    return obj
  })
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

// Colunas da aba "Chamados" (posicional):
// [0] ID, [1] Timestamp, [2] Unidade, [3] Solicitante, [4] Função, [5] Tipo,
// [6] Descrição, [7] Urgência, [8] Anexo, [9] Status, [10] Responsável,
// [11] Última Atualização, [12] Histórico, [13] Técnico Resolução, [14] Email
async function migrateChamados(rows: any[][]) {
  console.log('🎫 Migrando chamados...')
  const mapaTecnicos = getMapaTecnicos()

  const dados: any[] = []
  for (const row of rows.slice(1)) {
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
      tecnicoSetor,
      email: str(row[14]) || null
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
  console.log('🚀 Iniciando migração Google Sheets → Supabase...')
  console.log(`   Planilha: ${SHEET_ID}`)

  const sheets = await getSheets()

  const usuariosRows = toObjects(await readSheet(sheets, 'Usuarios'))
  const equipamentosRows = toObjects(await readSheet(sheets, 'Equipamentos'))
  const chamadosRows = await readSheet(sheets, 'Chamados')

  await migrateUsuarios(usuariosRows)
  await migrateEquipamentos(equipamentosRows)
  await prisma.chamado.deleteMany({})
  await migrateChamados(chamadosRows)

  console.log('✅ Migração concluída!')
}

main()
  .catch(e => { console.error('❌ Erro na migração:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())