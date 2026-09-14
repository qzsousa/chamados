import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../config/prisma'
import { google } from 'googleapis'
import bcrypt from 'bcryptjs'
import { passwordPolicy } from '../utils/tokens'
import { normalizarNomeEscola, getMapaTecnicos, padronizarNomeEscola, gerarChavesInventario, NOMES_PADRONIZADOS } from './normalization'

const BCRYPT_COST = 12

interface SheetsConfig {
  serviceAccountJson: string
  sheetsId: string
}

async function getSheetsClient(config: SheetsConfig) {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(config.serviceAccountJson),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  })
  return google.sheets({ version: 'v4', auth })
}

async function readSheet(sheets: any, sheetName: string, spreadsheetId?: string) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId || process.env.GOOGLE_SHEETS_ID,
    range: `${sheetName}!A:Z`
  })
  return response.data.values || []
}

async function getServiceAccountJson(): Promise<string> {
  let serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) {
    try {
      serviceAccountJson = readFileSync(join(process.cwd(), 'gcp-service-account.json'), 'utf-8')
    } catch {
      serviceAccountJson = ''
    }
  }
  return serviceAccountJson
}

export async function runMigration() {
  const serviceAccountJson = await getServiceAccountJson()

  const sheetsId = process.env.GOOGLE_SHEETS_ID

  if (!serviceAccountJson || !sheetsId) {
    console.log('⚠️ GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_SHEETS_ID não configurados. Pulando migração.')
    return
  }

  console.log('🚀 Iniciando migração Google Sheets → Supabase...')

  const sheets = await getSheetsClient({ serviceAccountJson, sheetsId })

  await migrateUsuarios(sheets)
  await migrateEscolas()
  await migrateEquipamentos(sheets)
  await migrateInventario(sheets)
  await migrateChamados(sheets)

  console.log('✅ Migração concluída!')
}

// Sincroniza apenas escolas + inventário (leve, reutilizável para agendamentos)
export async function syncInventario(): Promise<{ ok: boolean; motivo?: string }> {
  const serviceAccountJson = await getServiceAccountJson()
  const sheetsId = process.env.GOOGLE_INVENTARIO_SHEETS_ID || process.env.GOOGLE_SHEETS_ID

  if (!serviceAccountJson || !sheetsId) {
    const motivo = 'GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_INVENTARIO_SHEETS_ID não configurados'
    console.log(`⚠️ [inventario:sync] ${motivo}. Pulando.`)
    return { ok: false, motivo }
  }

  const sheets = await getSheetsClient({ serviceAccountJson, sheetsId })
  await migrateEscolas()
  await migrateInventario(sheets)
  console.log('✅ [inventario:sync] concluído.')
  return { ok: true }
}

async function migrateUsuarios(sheets: any) {
  console.log('📋 Migrando usuários...')
  const rows = await readSheet(sheets, 'Usuarios')
  if (rows.length < 2) { console.log('  Nenhum usuário encontrado'); return }

  const headers = rows[0]
  const idx = {
    email: headers.indexOf('email'),
    nome: headers.indexOf('nome'),
    nivel: headers.indexOf('nivel'),
    filial: headers.indexOf('filial'),
    status: headers.indexOf('status')
  }

  let criados = 0
  for (const row of rows.slice(1)) {
    const email = row[idx.email]?.toLowerCase().trim()
    const nome = row[idx.nome]?.trim()
    const nivel = row[idx.nivel]?.trim()
    const filial = row[idx.filial]?.trim()
    const status = row[idx.status]?.trim() || 'ATIVO'

    if (!email || !nome || !nivel || !filial) continue

    const existing = await prisma.usuario.findUnique({ where: { email } })
    if (existing) continue

    const senhaTemporaria = passwordPolicy.generateTemp()
    const senhaHash = await bcrypt.hash(senhaTemporaria, BCRYPT_COST)

    await prisma.usuario.create({
      data: {
        email,
        nome,
        nivel: nivel as any,
        filial,
        status: status as any,
        senhaHash,
        primeiroLogin: true
      }
    })

    console.log(`  ✅ ${email} | Senha temp: ${senhaTemporaria}`)
    criados++
  }
  console.log(`  Total: ${criados} usuários criados`)
}

export async function migrateEscolas() {
  console.log('🏫 Migrando escolas...')
  const mapaTecnicos = getMapaTecnicos()

  let criados = 0
  for (const nome of NOMES_PADRONIZADOS) {
    const existing = await prisma.escola.findUnique({ where: { nome } })
    if (existing) continue

    const normalizado = normalizarNomeEscola(nome)
    const tecnico = mapaTecnicos[normalizado] || ''

    await prisma.escola.create({
      data: { nome, nomeNormalizado: normalizado, tecnico }
    })
    criados++
  }
  console.log(`  Total: ${criados} escolas criadas`)
}

async function migrateEquipamentos(sheets: any) {
  console.log('💻 Migrando equipamentos...')
  const rows = await readSheet(sheets, 'Equipamentos')
  if (rows.length < 2) { console.log('  Nenhum equipamento encontrado'); return }

  const headers = rows[0]
  const findCol = (names: string[]) => {
    const lower = headers.map((h: string) => String(h).toLowerCase().trim())
    for (const n of names) {
      const idx = lower.indexOf(n.toLowerCase())
      if (idx !== -1) return idx
    }
    return -1
  }

  const idx = {
    id: findCol(['id', 'equipamento_id', 'codigo']),
    nome: findCol(['equipment_name', 'nome', 'equipamento', 'nome_equipamento']),
    categoria: findCol(['category', 'categoria', 'tipo']),
    marca: findCol(['brand', 'marca', 'fabricante']),
    modelo: findCol(['model', 'modelo', 'versao'])
  }

  if (idx.id === -1 || idx.nome === -1 || idx.categoria === -1 || idx.marca === -1 || idx.modelo === -1) {
    console.log('  ⚠️ Colunas não encontradas na aba Equipamentos')
    return
  }

  let criados = 0
  for (const row of rows.slice(1)) {
    const id = String(row[idx.id] || '').trim()
    const nome = String(row[idx.nome] || '').trim()
    const categoria = String(row[idx.categoria] || '').trim()
    const marca = String(row[idx.marca] || '').trim()
    const modelo = String(row[idx.modelo] || '').trim()

    if (!id || !nome || !categoria || !marca || !modelo) continue

    await prisma.equipamento.upsert({
      where: { categoria_marca_modelo: { categoria, marca, modelo } },
      update: {},
      create: { categoria, marca, modelo }
    })
    criados++
  }
  console.log(`  Total: ${criados} equipamentos migrados`)
}

export async function migrateInventario(sheets: any) {
  console.log('📦 Migrando inventário...')
  const inventarioSheetsId = process.env.GOOGLE_INVENTARIO_SHEETS_ID || process.env.GOOGLE_SHEETS_ID
  const rows = await readSheet(sheets, 'Base de Dados', inventarioSheetsId)
  if (rows.length < 2) { console.log('  Nenhum inventário encontrado'); return }

  const headers = rows[0]
  const idxEscola = headers.indexOf('Escola')
  const idxStatus = headers.indexOf('Status do Inventário')
  if (idxEscola === -1 || idxStatus === -1) {
    console.log('  ⚠️ Colunas não encontradas na aba Base de Dados')
    return
  }

  const escolasMap = new Map<string, string>()
  const escolas = await prisma.escola.findMany()
  for (const e of escolas) {
    escolasMap.set(e.nomeNormalizado, e.id)
    const chaves = gerarChavesInventario(e.nome)
    for (const c of chaves) if (!escolasMap.has(c)) escolasMap.set(c, e.id)
  }

  let atualizados = 0
  for (const row of rows.slice(1)) {
    const escolaNome = String(row[idxEscola] || '').trim()
    const statusRaw = String(row[idxStatus] || '').trim()
    if (!escolaNome || !statusRaw) continue

    const statusMap: Record<string, string> = {
      'Concluído': 'CONCLUIDO',
      'Em Andamento': 'EM_ANDAMENTO',
      'Não Realizado': 'NAO_REALIZADO'
    }
    const status = statusMap[statusRaw] || 'NAO_INFORMADO'

    const chaves = gerarChavesInventario(escolaNome)
    let escolaId: string | null = null
    for (const c of chaves) {
      if (escolasMap.has(c)) { escolaId = escolasMap.get(c)!; break }
    }

    if (!escolaId) continue

    await prisma.inventario.upsert({
      where: { escolaId },
      update: { status: status as any },
      create: { escolaId, status: status as any }
    })
    atualizados++
  }
  console.log(`  Total: ${atualizados} inventários migrados`)
}

// A coluna de protocolo (ID) pode estar sem rótulo na planilha (1ª célula vazia).
// Nesse caso, usamos as posições fixas do layout da aba:
// [0] ID, [1] Timestamp, [2] Unidade, [3] Solicitante, [4] Função, [5] Tipo,
// [6] Descrição, [7] Urgência, [8] Anexo, [9] Status, [10] Responsável,
// [11] Última Atualização, [12] Histórico, [13] Técnico Resolução, [14] Email
function colIndex(headers: any[], name: string, fallbackPos: number): number {
  const i = headers.indexOf(name)
  return i !== -1 ? i : fallbackPos
}

// A planilha retorna datas formatadas em pt-BR ("dd/MM/yyyy HH:mm:ss"), que o
// new Date() interpretaria como MM/dd/yyyy. Fazemos o parse manual.
function parseDataPlanilha(v: unknown): Date {
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000))
  if (v instanceof Date && !isNaN(v.getTime())) return v
  const s = String(v ?? '').trim()
  if (s) {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
    if (m) {
      const dt = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))
      if (!isNaN(dt.getTime())) return dt
    }
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

async function migrateChamados(sheets: any) {
  console.log('🎫 Migrando chamados...')
  const rows = await readSheet(sheets, 'Chamados')
  if (rows.length < 2) { console.log('  Nenhum chamado encontrado'); return }

  const headers = rows[0]
  const idx = {
    id: colIndex(headers, 'ID', 0),
    timestamp: colIndex(headers, 'Timestamp', 1),
    unidade: colIndex(headers, 'Unidade', 2),
    solicitante: colIndex(headers, 'Solicitante', 3),
    funcao: colIndex(headers, 'Função', 4),
    tipo: colIndex(headers, 'Tipo', 5),
    descricao: colIndex(headers, 'Descrição', 6),
    urgencia: colIndex(headers, 'Urgência', 7),
    anexo: colIndex(headers, 'Anexo', 8),
    status: colIndex(headers, 'Status', 9),
    responsavel: colIndex(headers, 'Responsável', 10),
    ultimaAtualizacao: colIndex(headers, 'Última Atualização', 11),
    historico: colIndex(headers, 'Histórico', 12),
    tecnicoResolucao: colIndex(headers, 'Técnico Resolução', 13),
    email: colIndex(headers, 'Email', 14)
  }

  const mapaTecnicos = getMapaTecnicos()
  const mapaInventario = await getMapaInventario()

  // Carrega os protocolos já existentes de uma vez (evita 1 query por linha)
  const existentes = new Set(
    (await prisma.chamado.findMany({ select: { protocolo: true } })).map(c => c.protocolo)
  )

  const vistos = new Set<string>()
  let duplicados = 0
  const novos: any[] = []

  const statusMap: Record<string, string> = {
    'Aberto': 'ABERTO', 'Em andamento': 'ANDAMENTO', 'Comunicado': 'COMUNICADO', 'Resolvido': 'RESOLVIDO'
  }

  for (const row of rows.slice(1)) {
    const protocolo = String(row[idx.id] || '').trim()
    if (!protocolo) continue

    const chave = `${row[idx.unidade] || ''}|${row[idx.descricao] || ''}|${row[idx.solicitante] || ''}|${row[idx.timestamp] || ''}`
    if (vistos.has(chave)) { duplicados++; continue }
    vistos.add(chave)

    if (existentes.has(protocolo)) { duplicados++; continue }

    const unidade = String(row[idx.unidade] || '').trim()
    const escolaNorm = normalizarNomeEscola(unidade)
    const tecnicoSetor = mapaTecnicos[escolaNorm] || ''
    const inventarioStatus = mapaInventario[escolaNorm] || null

    novos.push({
      protocolo,
      timestamp: parseDataPlanilha(row[idx.timestamp]),
      unidade,
      solicitante: String(row[idx.solicitante] || '').trim(),
      funcao: String(row[idx.funcao] || '').trim() || null,
      tipo: String(row[idx.tipo] || '').trim(),
      descricao: String(row[idx.descricao] || '').trim(),
      urgencia: String(row[idx.urgencia] || '').trim(),
      anexoUrl: String(row[idx.anexo] || '').trim() || null,
      status: (statusMap[String(row[idx.status] || '').trim()] || 'ABERTO') as any,
      responsavel: String(row[idx.responsavel] || '').trim() || null,
      ultimaAtualizacao: parseDataPlanilha(row[idx.ultimaAtualizacao]),
      historico: String(row[idx.historico] || '').trim() || null,
      tecnicoResolucao: String(row[idx.tecnicoResolucao] || '').trim() || null,
      tecnicoSetor,
      inventarioStatus: inventarioStatus as any,
      email: String(row[idx.email] || '').trim() || null
    })
  }

  let criados = 0
  for (let i = 0; i < novos.length; i += 100) {
    const r = await prisma.chamado.createMany({ data: novos.slice(i, i + 100), skipDuplicates: true })
    criados += r.count
  }
  console.log(`  Total: ${criados} chamados migrados, ${duplicados} duplicados ignorados`)
}

export async function getMapaInventario() {
  const inventarios = await prisma.inventario.findMany({ include: { escola: true } })
  const mapa: Record<string, string> = {}
  for (const inv of inventarios) {
    const chaves = gerarChavesInventario(inv.escola.nome)
    for (const c of chaves) if (!mapa[c]) mapa[c] = inv.status
  }
  return mapa
}

if (require.main === module) {
  runMigration()
    .catch(e => { console.error('❌ Erro na migração:', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
}