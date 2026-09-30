import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import chamadoRoutes, { criarChamadoPublic } from './chamados'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'

vi.mock('../config/prisma', () => ({
  prisma: {
    chamado: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}))

vi.mock('../services/normalization', () => ({
  normalizarNomeEscola: vi.fn((nome: string) => nome.toUpperCase().replace(/[^A-Z0-9]/g, '')),
  getMapaTecnicos: vi.fn(() => ({ TESTE: 'TECNICO1' }))
}))

vi.mock('../services/migration', () => ({
  getMapaInventario: vi.fn(() => Promise.resolve({ TESTE: 'CONCLUIDO' }))
}))

// Notificação e e-mail são efeitos colaterais: o teste é do status da resposta.
vi.mock('../services/notificacoes', () => ({
  notificarAdmins: vi.fn(() => Promise.resolve()),
  notificarUnidade: vi.fn(() => Promise.resolve()),
  notificarUsuario: vi.fn(() => Promise.resolve())
}))

vi.mock('../services/email', () => ({
  notificarChamadoStatusAlterado: vi.fn(() => Promise.resolve()),
  notificarChamadoCriado: vi.fn(() => Promise.resolve()),
  notificarChamadoConcluido: vi.fn(() => Promise.resolve())
}))

vi.mock('../services/encaminhamento', () => ({
  ...(vi.importActual<any> as any),
  encaminharPorRegras: vi.fn(() => Promise.resolve(false)),
  encaminharChamado: vi.fn(),
  tecnicosDaUnidade: vi.fn(() => Promise.resolve([])),
  encaminharPendentes: vi.fn(),
}))

/** Usuário do request — os testes trocam o nível (o DELETE em lote é só ADMIN). */
const usuario = { id: 'user-1', email: 'user@test.com', nome: 'Test User', nivel: 'TECNICO', filial: 'E.E. TESTE', status: 'ATIVO', primeiroLogin: false }

vi.mock('../middleware/auth', () => {
  const authMiddleware = (req: any, _res: any, next: any) => {
    req.user = { sub: usuario.id, email: usuario.email, nome: usuario.nome, nivel: usuario.nivel, filial: usuario.filial, type: 'access', iat: Date.now(), exp: Date.now() + 15 * 60 * 1000 }
    next()
  }
  const requireRole = (...roles: string[]) => (req: any, res: any, next: any) => {
    req.userRecord = { ...usuario }
    if (!roles.includes(req.userRecord.nivel)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão' })
    }
    next()
  }
  const attachUserRecord = (req: any, _res: any, next: any) => {
    req.userRecord = { ...usuario }
    next()
  }
  return { authMiddleware, requireRole, attachUserRecord }
})

/** Ids no formato cuid: o schema valida, e o fake 'chamado-1' vira 400. */
const CUID_1 = 'clh3k4j5k0000abcd1234efgh'
const CUID_2 = 'clh3k4j5k0000abcd1234efgi'

const createApp = () => {
  const app = express()
  app.use(express.json())
  // A criação é rota PÚBLICA, montada no index.ts antes do router autenticado.
  app.post('/api/chamados', criarChamadoPublic)
  app.use('/api/chamados', chamadoRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Chamados Routes', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
    Object.assign(usuario, { nivel: 'TECNICO', filial: 'E.E. TESTE', nome: 'Test User' })
  })

  describe('POST / (público)', () => {
    it('should return 400 for invalid data', async () => {
      const res = await request(app)
        .post('/api/chamados')
        .send({ unidade: '', solicitante: '', tipo: '', descricao: '', urgencia: '' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should create chamado with protocolo', async () => {
      vi.mocked(prisma.chamado.findFirst).mockResolvedValue(null)
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
          urgencia: 'Alta',
          email: 'solicitante@test.com'
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
      // A rota relê o chamado no fim (devolve a versão já salva): o mock
      // responde o original na primeira busca e o atualizado na segunda.
      vi.mocked(prisma.chamado.findUnique)
        .mockResolvedValueOnce({
          id: CUID_1,
          protocolo: 'CH-20240101-0001',
          unidade: 'E.E. TESTE',
          status: 'ABERTO',
          tecnicoSetor: 'TECNICO1',
          responsavel: 'Test User',
          historico: 'Histórico anterior',
          tecnicoResolucao: null
        })
        .mockResolvedValue({
          id: CUID_1,
          status: 'ANDAMENTO',
          responsavel: 'Test User',
          ultimaAtualizacao: new Date(),
          tecnicoResolucao: 'Técnico Resolução',
          historico: 'Histórico anterior\n[01/01/2024] Status alterado para "ANDAMENTO" por Test User (técnico: Técnico Resolução)'
        })
      vi.mocked(prisma.chamado.update).mockResolvedValue({
        id: CUID_1,
        status: 'ANDAMENTO',
        responsavel: 'Test User',
        ultimaAtualizacao: new Date(),
        tecnicoResolucao: 'Técnico Resolução',
        historico: 'Histórico anterior\n[01/01/2024] Status alterado para "ANDAMENTO" por Test User (técnico: Técnico Resolução)'
      })

      const res = await request(app)
        .patch(`/api/chamados/${CUID_1}/status`)
        .send({ status: 'ANDAMENTO', tecnicoResolucao: 'Técnico Resolução' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ANDAMENTO')
      expect(res.body.tecnicoResolucao).toBe('Técnico Resolução')
      expect(res.body.historico).toContain('Status alterado para "ANDAMENTO"')
    })

    // Regra de dono: o técnico só mexe no chamado dele ou da unidade dele.
    it('403 para técnico que não é o responsável e não atende a unidade', async () => {
      Object.assign(usuario, { filial: 'E.E. OUTRA' })
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue({
        id: CUID_1,
        protocolo: 'CH-20240101-0001',
        unidade: 'E.E. TESTE',
        status: 'ABERTO',
        responsavel: 'Outro Técnico',
        historico: ''
      })

      const res = await request(app)
        .patch(`/api/chamados/${CUID_1}/status`)
        .send({ status: 'ANDAMENTO' })

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('FORBIDDEN')
    })

    it('ADMIN mexe em qualquer chamado, de qualquer unidade', async () => {
      Object.assign(usuario, { nivel: 'ADMIN', filial: '' })
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue({
        id: CUID_1,
        protocolo: 'CH-20240101-0001',
        unidade: 'E.E. TESTE',
        status: 'ABERTO',
        responsavel: 'Outro Técnico',
        historico: ''
      })
      vi.mocked(prisma.chamado.update).mockResolvedValue({ id: CUID_1, status: 'RESOLVIDO', historico: 'x' })

      const res = await request(app)
        .patch(`/api/chamados/${CUID_1}/status`)
        .send({ status: 'RESOLVIDO', descricaoResolucao: 'Resolvido' })

      expect(res.status).toBe(200)
    })
  })

  describe('POST /:id/resposta', () => {
    it('should add resposta to historico', async () => {
      vi.mocked(prisma.chamado.findUnique)
        .mockResolvedValueOnce({
          id: CUID_1,
          protocolo: 'CH-20240101-0001',
          unidade: 'E.E. TESTE',
          status: 'ABERTO',
          responsavel: 'Test User',
          historico: 'Histórico anterior'
        })
        .mockResolvedValue({
          id: CUID_1,
          historico: 'Histórico anterior\n[01/01/2024] Test User: Nova resposta'
        })
      vi.mocked(prisma.chamado.update).mockResolvedValue({
        id: CUID_1,
        historico: 'Histórico anterior\n[01/01/2024] Test User: Nova resposta'
      })

      const res = await request(app)
        .post(`/api/chamados/${CUID_1}/resposta`)
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
        { id: CUID_1, unidade: 'E.E. TESTE', responsavel: 'Test User', historico: '', tecnicoResolucao: null },
        { id: CUID_2, unidade: 'E.E. TESTE', responsavel: 'Test User', historico: '', tecnicoResolucao: null }
      ])
      vi.mocked(prisma.chamado.update).mockResolvedValue({})

      const res = await request(app)
        .patch('/api/chamados/batch')
        .send({ ids: [CUID_1, CUID_2], status: 'RESOLVIDO', resposta: 'Resolvido em lote' })

      expect(res.status).toBe(200)
      expect(res.body.atualizados).toBe(2)
      expect(prisma.chamado.update).toHaveBeenCalledTimes(2)
    })
  })

  describe('DELETE /batch', () => {
    it('should delete chamados (ADMIN only)', async () => {
      Object.assign(usuario, { nivel: 'ADMIN' })
      // Exclusão lógica: a rota marca `excluido: true` (updateMany), não apaga a linha.
      vi.mocked(prisma.chamado.updateMany).mockResolvedValue({ count: 2 })

      const res = await request(app)
        .delete('/api/chamados/batch')
        .send({ ids: [CUID_1, CUID_2] })

      expect(res.status).toBe(200)
      expect(res.body.removidos).toBe(2)
      expect(prisma.chamado.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { excluido: true } }),
      )
    })

    it('403 para quem não é ADMIN', async () => {
      const res = await request(app)
        .delete('/api/chamados/batch')
        .send({ ids: [CUID_1, CUID_2] })

      expect(res.status).toBe(403)
    })
  })
})