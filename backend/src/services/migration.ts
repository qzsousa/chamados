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

export async function runMigration() {
  let serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON

  if (!serviceAccountJson) {
    try {
      serviceAccountJson = readFileSync(join(process.cwd(), 'gcp-service-account.json'), 'utf-8')
    } catch {
      serviceAccountJson = ''
    }
  }

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

async function migrateEscolas() {
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

async function migrateInventario(sheets: any) {
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

async function migrateChamados(sheets: any) {
  console.log('🎫 Migrando chamados...')
  const rows = await readSheet(sheets, 'Chamados')
  if (rows.length < 2) { console.log('  Nenhum chamado encontrado'); return }

  const headers = rows[0]
  const idx = {
    id: headers.indexOf('ID'),
    timestamp: headers.indexOf('Timestamp'),
    unidade: headers.indexOf('Unidade'),
    solicitante: headers.indexOf('Solicitante'),
    funcao: headers.indexOf('Função'),
    tipo: headers.indexOf('Tipo'),
    descricao: headers.indexOf('Descrição'),
    urgencia: headers.indexOf('Urgência'),
    anexo: headers.indexOf('Anexo'),
    status: headers.indexOf('Status'),
    responsavel: headers.indexOf('Responsável'),
    ultimaAtualizacao: headers.indexOf('Última Atualização'),
    historico: headers.indexOf('Histórico'),
    tecnicoResolucao: headers.indexOf('Técnico Resolução')
  }

  const mapaTecnicos = getMapaTecnicos()
  const mapaInventario = await getMapaInventario()

  const vistos = new Set<string>()
  let criados = 0
  let duplicados = 0

  for (const row of rows.slice(1)) {
    const protocolo = String(row[idx.id] || '').trim()
    if (!protocolo) continue

    const chave = `${row[idx.unidade] || ''}|${row[idx.descricao] || ''}|${row[idx.solicitante] || ''}|${row[idx.timestamp] || ''}`
    if (vistos.has(chave)) { duplicados++; continue }
    vistos.add(chave)

    const existing = await prisma.chamado.findUnique({ where: { protocolo } })
    if (existing) { duplicados++; continue }

    const unidade = String(row[idx.unidade] || '').trim()
    const escolaNorm = normalizarNomeEscola(unidade)
    const tecnicoSetor = mapaTecnicos[escolaNorm] || ''
    const inventarioStatus = mapaInventario[escolaNorm] || null

    const statusMap: Record<string, string> = {
      'Aberto': 'ABERTO', 'Em andamento': 'ANDAMENTO', 'Comunicado': 'COMUNICADO', 'Resolvido': 'RESOLVIDO'
    }

    await prisma.chamado.create({
      data: {
        protocolo,
        timestamp: row[idx.timestamp] ? new Date(row[idx.timestamp]) : new Date(),
        unidade,
        solicitante: String(row[idx.solicitante] || '').trim(),
        funcao: String(row[idx.funcao] || '').trim() || null,
        tipo: String(row[idx.tipo] || '').trim(),
        descricao: String(row[idx.descricao] || '').trim(),
        urgencia: String(row[idx.urgencia] || '').trim(),
        anexoUrl: String(row[idx.anexo] || '').trim() || null,
        status: (statusMap[String(row[idx.status] || '').trim()] || 'ABERTO') as any,
        responsavel: String(row[idx.responsavel] || '').trim() || null,
        ultimaAtualizacao: row[idx.ultimaAtualizacao] ? new Date(row[idx.ultimaAtualizacao]) : new Date(),
        historico: String(row[idx.historico] || '').trim() || null,
        tecnicoResolucao: String(row[idx.tecnicoResolucao] || '').trim() || null,
        tecnicoSetor,
        inventarioStatus: inventarioStatus as any
      }
    })
    criados++
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