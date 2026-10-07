import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import notificacaoRoutes from './notificacoes'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'

vi.mock('../config/prisma', () => ({
  prisma: {
    notificacao: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    }
  }
}))

/** Usuário do request — os testes trocam nível e filial. */
const usuario = { id: 'user-1', email: 'tec@test.com', nome: 'Tec Teste', nivel: 'TECNICO', filial: 'E.E. BELIZE, E.E. JARDIM IGUATEMI', status: 'ATIVO', primeiroLogin: false }

vi.mock('../middleware/auth', () => {
  const authMiddleware = (req: any, _res: any, next: any) => {
    req.user = { sub: usuario.id, email: usuario.email, nome: usuario.nome, nivel: usuario.nivel, filial: usuario.filial, type: 'access' }
    req.userRecord = { ...usuario }
    next()
  }
  const attachUserRecord = (req: any, _res: any, next: any) => {
    req.userRecord = { ...usuario }
    next()
  }
  return { authMiddleware, attachUserRecord }
})

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/notificacoes', notificacaoRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Notificações Routes', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
    Object.assign(usuario, { nivel: 'TECNICO', filial: 'E.E. BELIZE, E.E. JARDIM IGUATEMI' })
  })

  describe('GET /', () => {
    it('técnico com várias unidades na filial recebe 200 (não 500)', async () => {
      vi.mocked(prisma.notificacao.findMany).mockResolvedValue([])
      vi.mocked(prisma.notificacao.count).mockResolvedValue(0)

      const res = await request(app).get('/api/notificacoes')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: [], naoLidas: 0 })
    })

    it('filtra as notificações pelo campo `filial` (o model Notificacao não tem `unidade`)', async () => {
      vi.mocked(prisma.notificacao.findMany).mockResolvedValue([])
      vi.mocked(prisma.notificacao.count).mockResolvedValue(0)

      await request(app).get('/api/notificacoes')

      const where = vi.mocked(prisma.notificacao.findMany).mock.calls[0][0]?.where as any
      const clausulas = JSON.stringify(where)
      expect(clausulas).toContain('filial')
      expect(clausulas).not.toContain('"unidade"')
      // TODAS as unidades do técnico entram no filtro (normalizadas, sem "E.E.")
      expect(clausulas).toContain('BELIZE')
      expect(clausulas).toContain('JARDIM IGUATEMI')
    })

    it('ADMIN sem filial recebe 200 e enxerga o broadcast (usuarioId null)', async () => {
      Object.assign(usuario, { nivel: 'ADMIN', filial: '' })
      vi.mocked(prisma.notificacao.findMany).mockResolvedValue([])
      vi.mocked(prisma.notificacao.count).mockResolvedValue(0)

      const res = await request(app).get('/api/notificacoes')

      expect(res.status).toBe(200)
      const where = vi.mocked(prisma.notificacao.findMany).mock.calls[0][0]?.where as any
      expect(JSON.stringify(where)).toContain('"usuarioId":null')
    })
  })
})
