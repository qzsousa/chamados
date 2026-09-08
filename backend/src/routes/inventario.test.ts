import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import inventarioRoutes from './inventario'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'

vi.mock('../config/prisma', () => ({
  prisma: {
    inventario: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn()
    }
  }
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((req: any, _res: any, next: any) => {
    req.user = { sub: 'user-1', email: 'user@test.com', nome: 'Test User', nivel: 'ADMIN', filial: 'FILIAL1', type: 'access', iat: Date.now(), exp: Date.now() + 15 * 60 * 1000 }
    next()
  }),
  requireRole: vi.fn((...roles: string[]) => (req: any, _res: any, next: any) => {
    req.userRecord = { id: 'user-1', email: 'user@test.com', nome: 'Test User', nivel: 'ADMIN', filial: 'FILIAL1', status: 'ATIVO', primeiroLogin: false }
    if (!roles.includes(req.userRecord.nivel)) {
      return _res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão' })
    }
    next()
  })
}))

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/inventario', inventarioRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Inventario Routes', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
  })

  describe('GET /', () => {
    it('should return all inventarios with escola', async () => {
      vi.mocked(prisma.inventario.findMany).mockResolvedValue([
        { id: '1', escolaId: 'escola-1', status: 'CONCLUIDO', updatedAt: new Date(), escola: { id: 'escola-1', nome: 'E.E. TESTE 1', nomeNormalizado: 'ESCOLA1', tecnico: 'TECNICO1', createdAt: new Date(), updatedAt: new Date() } },
        { id: '2', escolaId: 'escola-2', status: 'EM_ANDAMENTO', updatedAt: new Date(), escola: { id: 'escola-2', nome: 'E.E. TESTE 2', nomeNormalizado: 'ESCOLA2', tecnico: 'TECNICO2', createdAt: new Date(), updatedAt: new Date() } }
      ])

      const res = await request(app).get('/api/inventario')

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
      expect(res.body[0].escola.nome).toBe('E.E. TESTE 1')
    })
  })

  describe('GET /:escolaId', () => {
    it('should return 404 for non-existent inventario', async () => {
      vi.mocked(prisma.inventario.findUnique).mockResolvedValue(null)

      const res = await request(app).get('/api/inventario/non-existent')

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })

    it('should return inventario with escola', async () => {
      vi.mocked(prisma.inventario.findUnique).mockResolvedValue({
        id: '1',
        escolaId: 'escola-1',
        status: 'CONCLUIDO',
        updatedAt: new Date(),
        escola: { id: 'escola-1', nome: 'E.E. TESTE 1', nomeNormalizado: 'ESCOLA1', tecnico: 'TECNICO1', createdAt: new Date(), updatedAt: new Date() }
      })

      const res = await request(app).get('/api/inventario/escola-1')

      expect(res.status).toBe(200)
      expect(res.body.escolaId).toBe('escola-1')
      expect(res.body.status).toBe('CONCLUIDO')
    })
  })

  describe('PATCH /:escolaId', () => {
    it('should return 400 for invalid status', async () => {
      const res = await request(app).patch('/api/inventario/escola-1').send({ status: 'INVALID' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should upsert inventario', async () => {
      vi.mocked(prisma.inventario.upsert).mockResolvedValue({
        id: '1',
        escolaId: 'escola-1',
        status: 'CONCLUIDO',
        updatedAt: new Date(),
        escola: { id: 'escola-1', nome: 'E.E. TESTE 1', nomeNormalizado: 'ESCOLA1', tecnico: 'TECNICO1', createdAt: new Date(), updatedAt: new Date() }
      })

      const res = await request(app).patch('/api/inventario/escola-1').send({ status: 'CONCLUIDO' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('CONCLUIDO')
      expect(prisma.inventario.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { escolaId: 'escola-1' },
        update: { status: 'CONCLUIDO' },
        create: { escolaId: 'escola-1', status: 'CONCLUIDO' }
      }))
    })
  })
})