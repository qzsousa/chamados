import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import dashboardRoutes from './dashboard'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'

vi.mock('../config/prisma', () => ({
  prisma: {
    chamado: {
      findMany: vi.fn(),
      count: vi.fn()
    }
  }
}))

vi.mock('../services/normalization', () => ({
  normalizarNomeEscola: vi.fn((nome: string) => nome.toUpperCase().replace(/[^A-Z0-9]/g, '')),
  getMapaTecnicos: vi.fn(() => ({ ESCOLA1: 'TECNICO1', ESCOLA2: 'TECNICO2' }))
}))

vi.mock('../services/migration', () => ({
  getMapaInventario: vi.fn(() => Promise.resolve({ ESCOLA1: 'CONCLUIDO', ESCOLA2: 'EM_ANDAMENTO' }))
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((req: any, _res: any, next: any) => {
    req.user = { sub: 'user-1', email: 'user@test.com', nome: 'Test User', nivel: 'TECNICO', filial: 'FILIAL1', type: 'access', iat: Date.now(), exp: Date.now() + 15 * 60 * 1000 }
    next()
  }),
  attachUserRecord: vi.fn((req: any, _res: any, next: any) => {
    req.userRecord = { id: 'user-1', email: 'user@test.com', nome: 'Test User', nivel: 'TECNICO', filial: 'FILIAL1', status: 'ATIVO', primeiroLogin: false }
    next()
  })
}))

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/dashboard', dashboardRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Dashboard Routes', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
  })

  describe('GET /matriz', () => {
    it('should return dashboard matriz data without auth', async () => {
      const chamados = [
        { id: '1', status: 'ABERTO', urgencia: 'Alta - Urgente', tecnicoResolucao: null, unidade: 'E.E. TESTE', timestamp: new Date(), ultimaAtualizacao: new Date(), historico: null, tipo: 'Hardware' },
        { id: '2', status: 'RESOLVIDO', urgencia: 'Normal', tecnicoResolucao: 'Técnico 1', unidade: 'E.E. TESTE 2', timestamp: new Date(), ultimaAtualizacao: new Date(), historico: null, tipo: 'Software' }
      ]
      vi.mocked(prisma.chamado.findMany).mockResolvedValue(chamados)
      vi.mocked(prisma.chamado.count).mockResolvedValue(2)

      const res = await request(app).get('/api/dashboard/matriz')

      expect(res.status).toBe(200)
      expect(res.body.kpis).toEqual({
        total: 2,
        abertos: 1,
        andamento: 0,
        comunicado: 0,
        resolvidos: 1,
        altaPrioridade: 1
      })
      expect(res.body.chamados).toHaveLength(2)
      expect(res.body.graficos).toEqual({
        porStatus: { ABERTO: 1, RESOLVIDO: 1 },
        porUrgencia: { Alta: 1, Normal: 1 },
        resolvidosPorTecnico: { 'Técnico 1': 1 }
      })
    })

    it('should limit chamados to 100', async () => {
      const chamados = Array.from({ length: 150 }, (_, i) => ({
        id: `${i}`,
        status: 'ABERTO',
        urgencia: 'Normal',
        tecnicoResolucao: null,
        unidade: 'E.E. TESTE',
        timestamp: new Date(),
        ultimaAtualizacao: new Date(),
        historico: null,
        tipo: 'Hardware'
      }))
      vi.mocked(prisma.chamado.findMany).mockResolvedValue(chamados)
      vi.mocked(prisma.chamado.count).mockResolvedValue(150)

      const res = await request(app).get('/api/dashboard/matriz')

      expect(res.status).toBe(200)
      expect(res.body.chamados).toHaveLength(100)
    })
  })

  describe('GET /filtrado', () => {
    it('should return filtered dashboard for authenticated user', async () => {
      const chamados = [
        { id: '1', status: 'ABERTO', urgencia: 'Alta - Urgente', tecnicoResolucao: null, unidade: 'FILIAL1', timestamp: new Date(Date.now() - 3600000), ultimaAtualizacao: new Date(Date.now() - 3600000), historico: '[01/01/2024] Status alterado para "ANDAMENTO" por User (técnico: Tech)', tipo: 'Hardware' }
      ]
      vi.mocked(prisma.chamado.findMany).mockResolvedValue(chamados)
      vi.mocked(prisma.chamado.count).mockResolvedValue(1)

      const res = await request(app).get('/api/dashboard/filtrado')

      expect(res.status).toBe(200)
      expect(res.body.kpis).toBeDefined()
      expect(res.body.avisos).toBeDefined()
      expect(res.body.inventario).toEqual({
        unidade: 'FILIAL1',
        tecnicoSetor: 'FILIAL1',
        status: 'CONCLUIDO'
      })
    })
  })

  describe('GET /stats', () => {
    it('should return stats for authenticated user', async () => {
      vi.mocked(prisma.chamado.count)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(2)

      const res = await request(app).get('/api/dashboard/stats')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        total: 10,
        abertos: 3,
        andamento: 2,
        comunicado: 1,
        resolvidos: 4,
        altaPrioridade: 2
      })
    })
  })
})