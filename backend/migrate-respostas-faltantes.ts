import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import { normalizarNomeEscola, getMapaTecnicos } from './src/services/normalization'
import { getMapaInventario } from './src/services/migration'

const XLSX_PATH = join(process.cwd(), '..', 'database', 'Teste em branco (respostas) (6).xlsx')

// Mapeamento de COR (preenchimento da linha em "Respostas ao formulário 1") → STATUS
const COR_STATUS: Record<string, string> = {
  // verdes → Resolvido
  '6AA84F': 'RESOLVIDO',
  '93C47D': 'RESOLVIDO',
  'B6D7A8': 'RESOLVIDO',
  'D9EAD3': 'RESOLVIDO',
  // amarelos → Em andamento
  'FFFF00': 'ANDAMENTO',
  'FFF2CC': 'ANDAMENTO',
  // azul → Comunicado
  'C9DAF8': 'COMUNICADO',
  // vermelho → Aberto
  'F4CCCC': 'ABERTO'
}

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

function tsKey(v: unknown): string {
  return typeof v === 'number' ? v.toFixed(6) : str(v)
}

function fgColorOfRow(ws: XLSX.WorkSheet, rowIndex: number): string {
  const cell = ws[XLSX.utils.encode_cell({ r: rowIndex, c: 0 })]
  const s = cell && cell.s ? cell.s : null
  const fgc = s && s.fgColor ? s.fgColor : null
  return fgc && fgc.rgb ? fgc.rgb : ''
}

async function gerarProtocolo(base: Date, existentes: Set<string>): Promise<string> {
  const y = base.getFullYear()
  const m = String(base.getMonth() + 1).padStart(2, '0')
  const d = String(base.getDate()).padStart(2, '0')
  const prefixo = `CH-${y}${m}${d}`
  let seq = 1
  let id = `${prefixo}-${String(seq).padStart(4, '0')}`
  while (existentes.has(id)) {
    seq++
    id = `${prefixo}-${String(seq).padStart(4, '0')}`
  }
  existentes.add(id)
  return id
}

async function main() {
  console.log('🚀 Migrando respostas ausentes (Respostas ao formulário 1 → Chamados)...')
  const wb = XLSX.readFile(XLSX_PATH, { cellStyles: true })

  const respWs = wb.Sheets['Respostas ao formulário 1']
  const chamWs = wb.Sheets['Chamados']

  const resp = XLSX.utils.sheet_to_json(respWs, { header: 1, defval: '' }).slice(1) as any[][]
  const cham = XLSX.utils.sheet_to_json(chamWs, { header: 1, defval: '' }).slice(1) as any[][]

  const existentesTs = new Set<string>()
  for (const c of cham) {
    const k = tsKey(c[1])
    if (k !== '') existentesTs.add(k)
  }

  const mapaTecnicos = getMapaTecnicos()
  const mapaInventario = await getMapaInventario()
  const protosExistentes = new Set((await prisma.chamado.findMany({ select: { protocolo: true } })).map(c => c.protocolo))

  const porStatus = new Map<string, number>()
  let criados = 0
  let ignorados = 0

  // linha 1 em sheet_to_json = primeira linha de dados; por isso respWs células começam na linha 1
  for (let i = 0; i < resp.length; i++) {
    const r = resp[i]
    const ts = r[0]
    if (ts === '' || existentesTs.has(tsKey(ts))) {
      ignorados++
      continue
    }

    const unidade = str(r[1])
    const solicitante = str(r[2])
    const funcao = str(r[3])
    const tipo = str(r[4])
    const descricao = str(r[5])
    const urgencia = str(r[6])

    const cor = fgColorOfRow(respWs, i + 1)
    const status = COR_STATUS[cor] || 'ABERTO'

    const timestamp = toDate(ts)
    const protocolo = await gerarProtocolo(timestamp, protosExistentes)
    const escolaNorm = normalizarNomeEscola(unidade)
    const tecnicoSetor = mapaTecnicos[escolaNorm] || ''
    const inventarioStatus = mapaInventario[escolaNorm] || null

    await prisma.chamado.create({
      data: {
        protocolo,
        timestamp,
        unidade,
        solicitante,
        funcao: funcao || null,
        tipo: tipo || 'Não informado',
        descricao: descricao || '(sem descrição)',
        urgencia: urgencia || 'Baixa',
        status: status as any,
        responsavel: null,
        tecnicoResolucao: null,
        tecnicoSetor,
        inventarioStatus: inventarioStatus as any,
        historico: `Migrado automaticamente do histórico do Forms (complemento) em ${new Date().toLocaleString('pt-BR')}`
      }
    })
    porStatus.set(status, (porStatus.get(status) || 0) + 1)
    criados++
  }

  console.log(`   Respostas processadas: ${resp.length}`)
  console.log(`   Criados: ${criados} | ignorados (já existiam): ${ignorados}`)
  console.log('   Por status:')
  for (const [s, n] of porStatus) console.log(`     ${s}: ${n}`)
  console.log('✅ Concluído!')
}

main()
  .catch(e => { console.error('❌ Erro na migração:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())