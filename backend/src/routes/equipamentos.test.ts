import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import equipamentoRoutes from './equipamentos'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'

vi.mock('../config/prisma', () => ({
  prisma: {
    equipamento: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn()
    }
  }
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
  app.use('/api/equipamentos', equipamentoRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Equipamentos Routes', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
  })

  describe('GET /', () => {
    it('should return equipamentos with filters', async () => {
      vi.mocked(prisma.equipamento.findMany).mockResolvedValue([
        { id: '1', categoria: 'Notebook', marca: 'Dell', modelo: 'Latitude 5520', createdAt: new Date(), updatedAt: new Date() }
      ])

      const res = await request(app).get('/api/equipamentos?categoria=Notebook&marca=Dell')

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(prisma.equipamento.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { categoria: 'Notebook', marca: 'Dell', modelo: undefined }
      }))
    })
  })

  describe('GET /categorias', () => {
    it('should return distinct categorias', async () => {
      vi.mocked(prisma.equipamento.findMany).mockResolvedValue([
        { categoria: 'Notebook' },
        { categoria: 'Desktop' }
      ])

      const res = await request(app).get('/api/equipamentos/categorias')

      expect(res.status).toBe(200)
      expect(res.body).toEqual(['Notebook', 'Desktop'])
    })
  })

  describe('GET /marcas', () => {
    it('should return 400 without categoria', async () => {
      const res = await request(app).get('/api/equipamentos/marcas')

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should return distinct marcas for categoria', async () => {
      vi.mocked(prisma.equipamento.findMany).mockResolvedValue([
        { marca: 'Dell' },
        { marca: 'HP' }
      ])

      const res = await request(app).get('/api/equipamentos/marcas?categoria=Notebook')

      expect(res.status).toBe(200)
      expect(res.body).toEqual(['Dell', 'HP'])
    })
  })

  describe('GET /modelos', () => {
    it('should return 400 without categoria and marca', async () => {
      const res = await request(app).get('/api/equipamentos/modelos')

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should return distinct modelos for categoria and marca', async () => {
      vi.mocked(prisma.equipamento.findMany).mockResolvedValue([
        { modelo: 'Latitude 5520' },
        { modelo: 'Latitude 5530' }
      ])

      const res = await request(app).get('/api/equipamentos/modelos?categoria=Notebook&marca=Dell')

      expect(res.status).toBe(200)
      expect(res.body).toEqual(['Latitude 5520', 'Latitude 5530'])
    })
  })

  describe('POST /', () => {
    it('should return 400 for invalid data', async () => {
      const res = await request(app).post('/api/equipamentos').send({ categoria: '', marca: '', modelo: '' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should return 409 for existing equipamento', async () => {
      vi.mocked(prisma.equipamento.findUnique).mockResolvedValue({ id: '1' })

      const res = await request(app).post('/api/equipamentos').send({ categoria: 'Notebook', marca: 'Dell', modelo: 'Latitude 5520' })

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should create equipamento', async () => {
      vi.mocked(prisma.equipamento.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.equipamento.create).mockResolvedValue({
        id: 'new-1',
        categoria: 'Monitor',
        marca: 'LG',
        modelo: '27UL500',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const res = await request(app).post('/api/equipamentos').send({ categoria: 'Monitor', marca: 'LG', modelo: '27UL500' })

      expect(res.status).toBe(201)
      expect(res.body.categoria).toBe('Monitor')
      expect(res.body.marca).toBe('LG')
      expect(res.body.modelo).toBe('27UL500')
    })
  })
})