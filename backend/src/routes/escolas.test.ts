import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import escolaRoutes from './escolas'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'

vi.mock('../config/prisma', () => ({
  prisma: {
    escola: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn()
    }
  }
}))

vi.mock('../services/normalization', () => ({
  normalizarNomeEscola: vi.fn((nome: string) => nome.toUpperCase().replace(/[^A-Z0-9]/g, '')),
  getMapaTecnicos: vi.fn(() => ({ ESCOLA1: 'TECNICO1', ESCOLA2: 'TECNICO2' })),
  NOMES_PADRONIZADOS: ['E.E. TESTE 1', 'E.E. TESTE 2']
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((req: any, _res: any, next: any) => {
    req.user = { sub: 'user-1', email: 'user@test.com', nome: 'Test User', nivel: 'ADMIN', filial: 'FILIAL1', type: 'access', iat: Date.now(), exp: Date.now() + 15 * 60 * 1000 }
    next()
  })
}))

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/escolas', escolaRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Escolas Routes', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
  })

  describe('GET /', () => {
    it('should return enriched escolas with tecnico', async () => {
      vi.mocked(prisma.escola.findMany).mockResolvedValue([
        { id: '1', nome: 'E.E. TESTE 1', nomeNormalizado: 'ESCOLA1', tecnico: 'OLD', createdAt: new Date(), updatedAt: new Date() },
        { id: '2', nome: 'E.E. TESTE 2', nomeNormalizado: 'ESCOLA2', tecnico: 'OLD', createdAt: new Date(), updatedAt: new Date() }
      ])

      const res = await request(app).get('/api/escolas')

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
      expect(res.body[0].tecnico).toBe('TECNICO1')
      expect(res.body[1].tecnico).toBe('TECNICO2')
    })
  })

  describe('GET /tecnicos', () => {
    it('should return mapa de tecnicos', async () => {
      const res = await request(app).get('/api/escolas/tecnicos')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ ESCOLA1: 'TECNICO1', ESCOLA2: 'TECNICO2' })
    })
  })

  describe('GET /nomes-padronizados', () => {
    it('should return nomes padronizados', async () => {
      const res = await request(app).get('/api/escolas/nomes-padronizados')

      expect(res.status).toBe(200)
      expect(res.body).toEqual(['E.E. TESTE 1', 'E.E. TESTE 2'])
    })
  })

  describe('POST /', () => {
    it('should return 400 for invalid data', async () => {
      const res = await request(app).post('/api/escolas').send({ nome: '', tecnico: '' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should return 409 for existing escola', async () => {
      vi.mocked(prisma.escola.findUnique).mockResolvedValue({ id: '1', nome: 'E.E. TESTE' })

      const res = await request(app).post('/api/escolas').send({ nome: 'E.E. TESTE', tecnico: 'TECNICO1' })

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should create escola', async () => {
      vi.mocked(prisma.escola.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.escola.create).mockResolvedValue({
        id: 'new-1',
        nome: 'E.E. NOVA',
        nomeNormalizado: 'ESCOLANOVA',
        tecnico: 'TECNICO1',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const res = await request(app).post('/api/escolas').send({ nome: 'E.E. NOVA', tecnico: 'TECNICO1' })

      expect(res.status).toBe(201)
      expect(res.body.nome).toBe('E.E. NOVA')
      expect(res.body.nomeNormalizado).toBe('ESCOLANOVA')
    })
  })
})