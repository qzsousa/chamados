import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import chamadoRoutes from './chamados'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'

vi.mock('../config/prisma', () => ({
  prisma: {
    chamado: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn()
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

vi.mock('../middleware/auth', () => {
  const authMiddleware = (req: any, _res: any, next: any) => {
    req.user = { sub: 'user-1', email: 'user@test.com', nome: 'Test User', nivel: 'TECNICO', filial: 'FILIAL1', type: 'access', iat: Date.now(), exp: Date.now() + 15 * 60 * 1000 }
    next()
  }
  const requireRole = (...roles: string[]) => (req: any, _res: any, next: any) => {
    req.userRecord = { id: 'user-1', email: 'user@test.com', nome: 'Test User', nivel: 'TECNICO', filial: 'FILIAL1', status: 'ATIVO', primeiroLogin: false }
    if (!roles.includes(req.userRecord.nivel)) {
      return _res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão' })
    }
    next()
  }
  const attachUserRecord = (req: any, _res: any, next: any) => {
    req.userRecord = { id: 'user-1', email: 'user@test.com', nome: 'Test User', nivel: 'TECNICO', filial: 'FILIAL1', status: 'ATIVO', primeiroLogin: false }
    next()
  }
  return { authMiddleware, requireRole, attachUserRecord }
})

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/chamados', chamadoRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Chamados Routes', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
  })

  describe('POST /', () => {
    it('should return 400 for invalid data', async () => {
      const res = await request(app)
        .post('/api/chamados')
        .send({ unidade: '', solicitante: '', tipo: '', descricao: '', urgencia: '' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should create chamado with protocolo', async () => {
      vi.mocked(prisma.chamado.create).mockResolvedValue({
        id: 'chamado-1',
        protocolo: 'CH-20240101-0001',
        timestamp: new Date(),
        unidade: 'E.E. TESTE',
        solicitante: 'João',
        funcao: null,
        tipo: 'Hardware',
        descricao: 'Problema no computador',
        urgencia: 'Alta',
        anexoUrl: null,
        status: 'ABERTO',
        responsavel: null,
        ultimaAtualizacao: new Date(),
        historico: 'Chamado criado em 01/01/2024',
        tecnicoResolucao: null,
        tecnicoSetor: 'TECNICO1',
        inventarioStatus: 'CONCLUIDO'
      })

      const res = await request(app)
        .post('/api/chamados')
        .send({
          unidade: 'E.E. TESTE',
          solicitante: 'João',
          tipo: 'Hardware',
          descricao: 'Problema no computador',
          urgencia: 'Alta'
        })

      expect(res.status).toBe(201)
      expect(res.body.protocolo).toMatch(/^CH-\d{8}-\d{4}$/)
      expect(res.body.unidade).toBe('E.E. TESTE')
      expect(res.body.tecnicoSetor).toBe('TECNICO1')
    })
  })

  describe('GET /', () => {
    it('should return paginated chamados', async () => {
      vi.mocked(prisma.chamado.count).mockResolvedValue(1)
      vi.mocked(prisma.chamado.findMany).mockResolvedValue([
        { id: 'chamado-1', protocolo: 'CH-20240101-0001', timestamp: new Date(), unidade: 'E.E. TESTE', solicitante: 'João', funcao: null, tipo: 'Hardware', descricao: 'Problema', urgencia: 'Alta', anexoUrl: null, status: 'ABERTO', responsavel: null, ultimaAtualizacao: new Date(), historico: null, tecnicoResolucao: null, tecnicoSetor: 'TECNICO1', inventarioStatus: 'CONCLUIDO' }
      ])

      const res = await request(app).get('/api/chamados')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 })
    })
  })

  describe('GET /:id', () => {
    it('should return 404 for non-existent chamado', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(null)

      const res = await request(app).get('/api/chamados/non-existent')

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })

    it('should return chamado data', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue({
        id: 'chamado-1',
        protocolo: 'CH-20240101-0001',
        timestamp: new Date(),
        unidade: 'E.E. TESTE',
        solicitante: 'João',
        funcao: null,
        tipo: 'Hardware',
        descricao: 'Problema',
        urgencia: 'Alta',
        anexoUrl: null,
        status: 'ABERTO',
        responsavel: null,
        ultimaAtualizacao: new Date(),
        historico: null,
        tecnicoResolucao: null,
        tecnicoSetor: 'TECNICO1',
        inventarioStatus: 'CONCLUIDO'
      })

      const res = await request(app).get('/api/chamados/chamado-1')

      expect(res.status).toBe(200)
      expect(res.body.id).toBe('chamado-1')
    })
  })

  describe('PATCH /:id/status', () => {
    it('should return 400 for invalid status', async () => {
      const res = await request(app)
        .patch('/api/chamados/chamado-1/status')
        .send({ status: 'INVALID' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should return 404 for non-existent chamado', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(null)

      const res = await request(app)
        .patch('/api/chamados/non-existent/status')
        .send({ status: 'ANDAMENTO' })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })

    it('should update status and add to historico', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue({
        id: 'chamado-1',
        unidade: 'E.E. TESTE',
        tecnicoSetor: 'TECNICO1',
        responsavel: null,
        historico: 'Histórico anterior',
        tecnicoResolucao: null
      })
      vi.mocked(prisma.chamado.update).mockResolvedValue({
        id: 'chamado-1',
        status: 'ANDAMENTO',
        responsavel: 'Test User',
        ultimaAtualizacao: new Date(),
        tecnicoResolucao: 'Técnico Resolução',
        historico: 'Histórico anterior\n[01/01/2024] Status alterado para "ANDAMENTO" por Test User (técnico: Técnico Resolução)'
      })

      const res = await request(app)
        .patch('/api/chamados/chamado-1/status')
        .send({ status: 'ANDAMENTO', tecnicoResolucao: 'Técnico Resolução' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ANDAMENTO')
      expect(res.body.tecnicoResolucao).toBe('Técnico Resolução')
      expect(res.body.historico).toContain('Status alterado para "ANDAMENTO"')
    })
  })

  describe('POST /:id/resposta', () => {
    it('should add resposta to historico', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue({
        id: 'chamado-1',
        historico: 'Histórico anterior'
      })
      vi.mocked(prisma.chamado.update).mockResolvedValue({
        id: 'chamado-1',
        historico: 'Histórico anterior\n[01/01/2024] Test User: Nova resposta'
      })

      const res = await request(app)
        .post('/api/chamados/chamado-1/resposta')
        .send({ texto: 'Nova resposta' })

      expect(res.status).toBe(200)
      expect(res.body.historico).toContain('Nova resposta')
    })
  })

  describe('PATCH /batch', () => {
    it('should return 400 for empty ids', async () => {
      const res = await request(app)
        .patch('/api/chamados/batch')
        .send({ ids: [], status: 'RESOLVIDO' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should batch update chamados', async () => {
      vi.mocked(prisma.chamado.findMany).mockResolvedValue([
        { id: 'chamado-1', unidade: 'E.E. TESTE', tecnicoSetor: 'TECNICO1', responsavel: null, historico: '', tecnicoResolucao: null },
        { id: 'chamado-2', unidade: 'E.E. TESTE', tecnicoSetor: 'TECNICO1', responsavel: null, historico: '', tecnicoResolucao: null }
      ])
      vi.mocked(prisma.chamado.update).mockResolvedValue({})

      const res = await request(app)
        .patch('/api/chamados/batch')
        .send({ ids: ['chamado-1', 'chamado-2'], status: 'RESOLVIDO', resposta: 'Resolvido em lote' })

      expect(res.status).toBe(200)
      expect(res.body.atualizados).toBe(2)
      expect(prisma.chamado.update).toHaveBeenCalledTimes(2)
    })
  })

  describe('DELETE /batch', () => {
    it('should delete chamados (ADMIN only)', async () => {
      vi.mocked(prisma.chamado.deleteMany).mockResolvedValue({ count: 2 })

      const res = await request(app)
        .delete('/api/chamados/batch')
        .send({ ids: ['chamado-1', 'chamado-2'] })

      expect(res.status).toBe(200)
      expect(res.body.removidos).toBe(2)
    })
  })
})