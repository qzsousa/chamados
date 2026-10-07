import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { consultarChamadoPublic, avaliarChamadoPublic } from './chamados'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'

vi.mock('../config/prisma', () => ({
  prisma: {
    chamado: {
      findUnique: vi.fn()
    },
    avaliacao: {
      findUnique: vi.fn(),
      create: vi.fn()
    }
  }
}))

vi.mock('../services/normalization', () => ({
  normalizarNomeEscola: vi.fn((nome: string) => nome.toUpperCase().replace(/[^A-Z0-9]/g, '')),
  getMapaTecnicos: vi.fn(() => ({})),
  LISTA_ESCOLAS_EMAILS: {}
}))

vi.mock('../services/migration', () => ({
  getMapaInventario: vi.fn(() => Promise.resolve({}))
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requireFilialAccess: () => (_req: any, _res: any, next: any) => next(),
  attachUserRecord: (_req: any, _res: any, next: any) => next()
}))

const PROTOCOLO = 'CH-20260923-0007'
const EMAIL = 'maria.silva@educacao.sp.gov.br'

/** Chamado de exemplo, como o `findUnique` o devolve. */
function chamadoBase(over: Record<string, any> = {}) {
  return {
    id: 'chamado-1',
    protocolo: PROTOCOLO,
    unidade: 'E.E. TESTE',
    solicitante: 'Maria Silva',
    email: EMAIL,
    tipo: 'Rede - Lentidão',
    status: 'RESOLVIDO',
    descricao: 'A sala 3 está sem rede',
    descricaoResolucao: 'Rack religado',
    anexoUrl: null,
    timestamp: new Date('2026-09-23T10:00:00.000Z'),
    ultimaAtualizacao: new Date('2026-09-24T10:00:00.000Z'),
    excluido: false,
    reaberturas: 0,
    avaliacao: null,
    mensagens: [],
    // A consulta pública inclui os registros de atendimento: o solicitante tem
    // direito de ler o que fizeram no equipamento dele.
    atividades: [],
    ...over
  }
}

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.get('/api/chamados/protocolo/:protocolo', consultarChamadoPublic)
  app.post('/api/chamados/protocolo/:protocolo/avaliar', avaliarChamadoPublic)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Consulta pública de chamado (protocolo + e-mail)', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
    vi.mocked(prisma.chamado.findUnique).mockResolvedValue(chamadoBase() as any)
  })

  const consultar = (email?: string, protocolo = PROTOCOLO) =>
    request(app)
      .get(`/api/chamados/protocolo/${protocolo}`)
      .query(email ? { email } : {})

  it('exige o e-mail junto com o protocolo', async () => {
    const res = await consultar()
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
    expect(prisma.chamado.findUnique).not.toHaveBeenCalled()
  })

  it('exige um e-mail em formato válido', async () => {
    const res = await consultar('nao-e-email')
    expect(res.status).toBe(400)
    expect(prisma.chamado.findUnique).not.toHaveBeenCalled()
  })

  it('abre o chamado com o par correto', async () => {
    const res = await consultar(EMAIL)
    expect(res.status).toBe(200)
    expect(res.body.protocolo).toBe(PROTOCOLO)
    expect(res.body.unidade).toBe('E.E. TESTE')
    expect(res.body.atividades).toEqual([])
    expect(res.body.reaberturas).toBe(0)
  })

  it('mostra ao solicitante os registros de atendimento do técnico', async () => {
    vi.mocked(prisma.chamado.findUnique).mockResolvedValue(chamadoBase({
      status: 'RESOLVIDO',
      atividades: [
        {
          id: 'at-1',
          tipo: 'REGISTRO',
          autorNome: 'João Técnico',
          texto: 'Testei a porta 3 do switch.',
          criadoEm: new Date('2026-09-23T15:00:00.000Z'),
          anexos: [{ nome: 'foto.jpg', tipo: 'image/jpeg', url: 'https://x/foto.jpg' }]
        }
      ]
    }) as any)
    const res = await consultar(EMAIL)
    expect(res.status).toBe(200)
    expect(res.body.atividades).toHaveLength(1)
    expect(res.body.atividades[0]).toMatchObject({ tipo: 'REGISTRO', autorNome: 'João Técnico' })
    expect(res.body.atividades[0].anexos[0].url).toBe('https://x/foto.jpg')
  })

  it('ignora maiúsculas e espaços do e-mail informado', async () => {
    const res = await consultar(`  ${EMAIL.toUpperCase()}  `)
    expect(res.status).toBe(200)
  })

  it('NÃO abre o chamado com e-mail diferente do cadastrado', async () => {
    const res = await consultar('outro.professor@educacao.sp.gov.br')
    expect(res.status).toBe(404)
    expect(res.body).not.toHaveProperty('unidade')
    expect(res.body).not.toHaveProperty('descricao')
  })

  it('NÃO abre chamado legado sem e-mail gravado', async () => {
    vi.mocked(prisma.chamado.findUnique).mockResolvedValue(chamadoBase({ email: null }) as any)
    const res = await consultar(EMAIL)
    expect(res.status).toBe(404)
  })

  it('NÃO abre chamado excluído', async () => {
    vi.mocked(prisma.chamado.findUnique).mockResolvedValue(chamadoBase({ excluido: true }) as any)
    const res = await consultar(EMAIL)
    expect(res.status).toBe(404)
  })

  it('responde o MESMO 404 para protocolo inexistente (não enumera chamados)', async () => {
    vi.mocked(prisma.chamado.findUnique).mockResolvedValue(null as any)
    const res = await consultar(EMAIL)
    expect(res.status).toBe(404)
    expect(res.body.message).toBe(
      'Chamado não encontrado. Confira o protocolo e o e-mail informados.'
    )
  })
})

describe('Avaliação pública do atendimento (protocolo + e-mail)', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
    vi.mocked(prisma.chamado.findUnique).mockResolvedValue(chamadoBase() as any)
    vi.mocked(prisma.avaliacao.findUnique).mockResolvedValue(null as any)
    vi.mocked(prisma.avaliacao.create).mockResolvedValue({ id: 'av-1', nota: 5, comentario: 'Ótimo' } as any)
  })

  const avaliar = (email: string | undefined, nota = 5) =>
    request(app)
      .post(`/api/chamados/protocolo/${PROTOCOLO}/avaliar`)
      .query(email ? { email } : {})
      .send({ nota })

  it('exige o e-mail do solicitante', async () => {
    const res = await avaliar(undefined)
    expect(res.status).toBe(400)
    expect(prisma.avaliacao.create).not.toHaveBeenCalled()
  })

  it('NÃO avalia com e-mail diferente do cadastrado', async () => {
    const res = await avaliar('outro.professor@educacao.sp.gov.br')
    expect(res.status).toBe(404)
    expect(prisma.avaliacao.create).not.toHaveBeenCalled()
  })

  it('NÃO avalia chamado legado sem e-mail gravado', async () => {
    vi.mocked(prisma.chamado.findUnique).mockResolvedValue(chamadoBase({ email: null }) as any)
    const res = await avaliar(EMAIL)
    expect(res.status).toBe(404)
    expect(prisma.avaliacao.create).not.toHaveBeenCalled()
  })

  it('avalia com o par correto', async () => {
    const res = await avaliar(EMAIL)
    expect(res.status).toBe(201)
    expect(res.body.nota).toBe(5)
    expect(prisma.avaliacao.create).toHaveBeenCalled()
  })

  it('recusa nota fora de 1 a 5 mesmo com o par correto', async () => {
    const res = await avaliar(EMAIL, 9)
    expect(res.status).toBe(400)
    expect(prisma.avaliacao.create).not.toHaveBeenCalled()
  })
})
