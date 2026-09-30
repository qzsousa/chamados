import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import feedbackRouter from './feedback'
import { prisma } from '../config/prisma'

vi.mock('../config/prisma', () => ({
  prisma: {
    avaliacao: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      create: vi.fn()
    },
    feedback: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn()
    }
  }
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requireFilialAccess: () => (_req: any, _res: any, next: any) => next(),
  attachUserRecord: (_req: any, _res: any, next: any) => next()
}))

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/feedback', feedbackRouter)
  return app
}

/** Avaliação como o `findMany` a devolve, com o chamado já embutido. */
function avaliacaoBase(over: Record<string, any> = {}) {
  return {
    id: 'av-1',
    nota: 2,
    comentario: 'Demorou três dias para responder.',
    criadoEm: new Date('2026-09-25T14:00:00.000Z'),
    chamado: {
      protocolo: 'CH-20260923-0007',
      unidade: 'E.E. TESTE',
      solicitante: 'Maria Silva',
      tipo: 'Rede - Lentidão',
      tecnicoResolucao: 'João Souza',
      tecnicoSetor: 'Marcos Lima',
      excluido: false
    },
    ...over
  }
}

describe('Listagem de avaliações com comentário (matriz)', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
    vi.mocked(prisma.avaliacao.count).mockResolvedValue(1 as any)
    vi.mocked(prisma.avaliacao.findMany).mockResolvedValue([avaliacaoBase()] as any)
  })

  it('devolve o comentário junto da nota e do contexto do chamado', async () => {
    const res = await request(app).get('/api/feedback/avaliacoes')

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toMatchObject({
      nota: 2,
      comentario: 'Demorou três dias para responder.',
      protocolo: 'CH-20260923-0007',
      unidade: 'E.E. TESTE',
      solicitante: 'Maria Silva',
      // Técnico que fechou o chamado ganha do técnico da unidade.
      tecnico: 'João Souza'
    })
    expect(res.body.meta).toMatchObject({ total: 1, page: 1, totalPages: 1 })
  })

  it('cai no técnico da unidade quando não há técnico de resolução', async () => {
    vi.mocked(prisma.avaliacao.findMany).mockResolvedValue([
      avaliacaoBase({ chamado: { ...avaliacaoBase().chamado, tecnicoResolucao: null } })
    ] as any)

    const res = await request(app).get('/api/feedback/avaliacoes')

    expect(res.body.data[0].tecnico).toBe('Marcos Lima')
  })

  it('devolve técnico nulo quando o chamado não tem nenhum dos dois', async () => {
    vi.mocked(prisma.avaliacao.findMany).mockResolvedValue([
      avaliacaoBase({ chamado: { ...avaliacaoBase().chamado, tecnicoResolucao: null, tecnicoSetor: null } })
    ] as any)

    const res = await request(app).get('/api/feedback/avaliacoes')

    expect(res.body.data[0].tecnico).toBeNull()
  })

  it('filtra por nota e ignora nota fora de 1 a 5', async () => {
    await request(app).get('/api/feedback/avaliacoes?nota=2')
    expect(vi.mocked(prisma.avaliacao.findMany).mock.calls[0][0]).toMatchObject({ where: { nota: 2 } })

    vi.mocked(prisma.avaliacao.findMany).mockClear()
    await request(app).get('/api/feedback/avaliacoes?nota=9')
    // Nota inválida não vira filtro: a lista volta inteira.
    expect(vi.mocked(prisma.avaliacao.findMany).mock.calls[0][0]).toMatchObject({
      where: { chamado: { excluido: false } }
    })
  })

  it('filtra somente as avaliações com comentário', async () => {
    await request(app).get('/api/feedback/avaliacoes?somenteComentarios=true')
    expect(vi.mocked(prisma.avaliacao.findMany).mock.calls[0][0]).toMatchObject({
      where: { comentario: { not: null }, chamado: { excluido: false } }
    })
  })

  it('esconde avaliação de chamado excluído', async () => {
    await request(app).get('/api/feedback/avaliacoes')
    expect(vi.mocked(prisma.avaliacao.findMany).mock.calls[0][0]).toMatchObject({
      where: { chamado: { excluido: false } }
    })
  })

  it('página além do total devolve lista vazia, sem erro', async () => {
    vi.mocked(prisma.avaliacao.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.avaliacao.count).mockResolvedValue(1 as any)

    const res = await request(app).get('/api/feedback/avaliacoes?page=5')

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta.total).toBe(1)
  })
})

describe('Estatísticas de avaliação', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
    vi.mocked(prisma.avaliacao.groupBy).mockResolvedValue([
      { nota: 1, _count: 1 },
      { nota: 5, _count: 3 }
    ] as any)
    vi.mocked(prisma.feedback.count).mockResolvedValue(7 as any)
  })

  it('calcula a média e a distribuição por nota', async () => {
    const res = await request(app).get('/api/feedback/stats')

    expect(res.status).toBe(200)
    expect(res.body.avaliacoes).toEqual({
      total: 4,
      media: 4,
      porNota: { '1': 1, '2': 0, '3': 0, '4': 0, '5': 3 }
    })
    expect(res.body.feedback).toEqual({ elogios: 7, sugestoes: 7 })
  })

  it('devolve média nula (e não zero) quando ninguém avaliou', async () => {
    vi.mocked(prisma.avaliacao.groupBy).mockResolvedValue([] as any)

    const res = await request(app).get('/api/feedback/stats')

    expect(res.body.avaliacoes.media).toBeNull()
    expect(res.body.avaliacoes.total).toBe(0)
  })
})
