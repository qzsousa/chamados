import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import tutorialRoutes from './tutoriais'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'

vi.mock('../config/prisma', () => ({
  prisma: {
    tutorialCategoria: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    tutorial: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    tutorialAnexo: {
      create: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}))

vi.mock('../services/anexos', () => ({
  salvarAnexo: vi.fn(async (_base64: string, _nome: string, _tipo: string, pasta: string) => `anexos/${pasta}_fake.png`)
}))

// Nível mutável para testar rotas de ADMIN com usuário não-admin
let mockNivel = 'ADMIN'

vi.mock('../middleware/auth', () => {
  const authMiddleware = (req: any, _res: any, next: any) => {
    req.user = { sub: 'user-1', email: 'user@test.com', nome: 'Admin User', nivel: mockNivel, filial: 'FILIAL1', type: 'access', iat: Date.now(), exp: Date.now() + 15 * 60 * 1000 }
    next()
  }
  const attachUserRecord = (req: any, _res: any, next: any) => {
    req.userRecord = { id: 'user-1', email: 'user@test.com', nome: 'Admin User', nivel: mockNivel, filial: 'FILIAL1', status: 'ATIVO', primeiroLogin: false }
    next()
  }
  const requireRole = (...roles: string[]) => (req: any, _res: any, next: any) => {
    if (!req.userRecord) {
      req.userRecord = { id: 'user-1', email: 'user@test.com', nome: 'Admin User', nivel: mockNivel, filial: 'FILIAL1', status: 'ATIVO', primeiroLogin: false }
    }
    if (!roles.includes(req.userRecord.nivel)) {
      return _res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão' })
    }
    next()
  }
  return { authMiddleware, attachUserRecord, requireRole }
})

const categoriaMock = { id: 'cat-1', nome: 'Redes', descricao: null, cor: '#3b82f6', createdAt: new Date() }
const tutorialMock = {
  id: 'tut-1',
  titulo: 'Como resetar senha',
  subtitulo: null,
  conteudo: 'Passo a passo...',
  categoriaId: 'cat-1',
  criadoPor: 'Admin User',
  visualizacoes: 4,
  createdAt: new Date(),
  updatedAt: new Date()
}

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/tutoriais', tutorialRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Tutoriais Routes', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
    mockNivel = 'ADMIN'
  })

  describe('GET /', () => {
    it('should return empty list', async () => {
      vi.mocked(prisma.tutorial.count).mockResolvedValue(0)
      vi.mocked(prisma.tutorial.findMany).mockResolvedValue([])

      const res = await request(app).get('/api/tutoriais')

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
      expect(res.body.meta).toEqual({ total: 0, page: 1, limit: 12, totalPages: 0 })
    })

    it('should search titulo, subtitulo and conteudo with q', async () => {
      vi.mocked(prisma.tutorial.count).mockResolvedValue(1)
      vi.mocked(prisma.tutorial.findMany).mockResolvedValue([tutorialMock])

      const res = await request(app).get('/api/tutoriais?q=senha&categoriaId=cat-1')

      expect(res.status).toBe(200)
      expect(prisma.tutorial.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          categoriaId: 'cat-1',
          OR: expect.arrayContaining([
            { titulo: { contains: 'senha', mode: 'insensitive' } },
            { subtitulo: { contains: 'senha', mode: 'insensitive' } },
            { conteudo: { contains: 'senha', mode: 'insensitive' } }
          ])
        })
      }))
    })
  })

  describe('POST /', () => {
    it('should return 403 for non-admin', async () => {
      mockNivel = 'TECNICO'

      const res = await request(app)
        .post('/api/tutoriais')
        .send({ titulo: 'T', conteudo: 'C', categoriaId: 'cat-1' })

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('FORBIDDEN')
    })

    it('should return 400 when titulo is missing', async () => {
      const res = await request(app)
        .post('/api/tutoriais')
        .send({ conteudo: 'C', categoriaId: 'cat-1' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should return 404 when categoria does not exist', async () => {
      vi.mocked(prisma.tutorialCategoria.findUnique).mockResolvedValue(null)

      const res = await request(app)
        .post('/api/tutoriais')
        .send({ titulo: 'T', conteudo: 'C', categoriaId: 'cat-x' })

      expect(res.status).toBe(404)
      expect(res.body.message).toBe('Categoria não encontrada.')
    })

    it('should create tutorial as admin', async () => {
      vi.mocked(prisma.tutorialCategoria.findUnique).mockResolvedValue(categoriaMock)
      vi.mocked(prisma.tutorial.create).mockResolvedValue(tutorialMock)
      vi.mocked(prisma.tutorial.findUnique).mockResolvedValue({ ...tutorialMock, categoria: categoriaMock, anexos: [] } as any)

      const res = await request(app)
        .post('/api/tutoriais')
        .send({ titulo: 'Como resetar senha', conteudo: 'Passo a passo...', categoriaId: 'cat-1' })

      expect(res.status).toBe(201)
      expect(res.body.id).toBe('tut-1')
      expect(prisma.tutorial.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ titulo: 'Como resetar senha', criadoPor: 'Admin User' })
      }))
    })

    it('should save anexos under tutoriais/<id>', async () => {
      const { salvarAnexo } = await import('../services/anexos')
      vi.mocked(prisma.tutorialCategoria.findUnique).mockResolvedValue(categoriaMock)
      vi.mocked(prisma.tutorial.create).mockResolvedValue(tutorialMock)
      vi.mocked(prisma.tutorialAnexo.create).mockResolvedValue({ id: 'anx-1' } as any)
      vi.mocked(prisma.tutorial.findUnique).mockResolvedValue({ ...tutorialMock, categoria: categoriaMock, anexos: [{ id: 'anx-1' }] } as any)

      const res = await request(app)
        .post('/api/tutoriais')
        .send({
          titulo: 'Como resetar senha',
          conteudo: 'Passo a passo...',
          categoriaId: 'cat-1',
          anexos: [{ nome: 'guia.pdf', tipo: 'application/pdf', base64: 'aGVsbG8=' }]
        })

      expect(res.status).toBe(201)
      expect(salvarAnexo).toHaveBeenCalledWith('aGVsbG8=', 'guia.pdf', 'application/pdf', 'tutoriais/tut-1')
      expect(prisma.tutorialAnexo.create).toHaveBeenCalledWith({
        data: { tutorialId: 'tut-1', nome: 'guia.pdf', tipo: 'application/pdf', url: 'anexos/tutoriais/tut-1_fake.png' }
      })
    })
  })

  describe('GET /:id', () => {
    it('should return 404 for missing tutorial', async () => {
      vi.mocked(prisma.tutorial.update).mockRejectedValue({ code: 'P2025' })

      const res = await request(app).get('/api/tutoriais/inexistente')

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
      expect(res.body.message).toBe('Tutorial não encontrado.')
    })

    it('should increment visualizacoes on read', async () => {
      vi.mocked(prisma.tutorial.update).mockResolvedValue({ ...tutorialMock, visualizacoes: 5 } as any)

      const res = await request(app).get('/api/tutoriais/tut-1')

      expect(res.status).toBe(200)
      expect(res.body.visualizacoes).toBe(5)
      expect(prisma.tutorial.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'tut-1' },
        data: { visualizacoes: { increment: 1 } }
      }))
    })
  })

  describe('DELETE /categorias/:id', () => {
    it('should block delete when categoria has tutoriais', async () => {
      vi.mocked(prisma.tutorial.count).mockResolvedValue(3)

      const res = await request(app).delete('/api/tutoriais/categorias/cat-1')

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('CONFLICT')
      expect(res.body.message).toBe('Categoria possui tutoriais, mova-os antes de excluir.')
      expect(prisma.tutorialCategoria.delete).not.toHaveBeenCalled()
    })

    it('should delete empty categoria', async () => {
      vi.mocked(prisma.tutorial.count).mockResolvedValue(0)
      vi.mocked(prisma.tutorialCategoria.delete).mockResolvedValue(categoriaMock)

      const res = await request(app).delete('/api/tutoriais/categorias/cat-1')

      expect(res.status).toBe(204)
    })
  })

  describe('POST /categorias', () => {
    it('should create categoria as admin', async () => {
      vi.mocked(prisma.tutorialCategoria.create).mockResolvedValue(categoriaMock)

      const res = await request(app)
        .post('/api/tutoriais/categorias')
        .send({ nome: 'Redes', cor: '#3b82f6' })

      expect(res.status).toBe(201)
      expect(res.body.nome).toBe('Redes')
    })

    it('should return 409 for duplicate nome', async () => {
      vi.mocked(prisma.tutorialCategoria.create).mockRejectedValue({ code: 'P2002' })

      const res = await request(app)
        .post('/api/tutoriais/categorias')
        .send({ nome: 'Redes' })

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('CONFLICT')
      expect(res.body.message).toBe('Já existe uma categoria com esse nome.')
    })

    it('should return 403 for non-admin', async () => {
      mockNivel = 'VISUALIZADOR'

      const res = await request(app)
        .post('/api/tutoriais/categorias')
        .send({ nome: 'Redes' })

      expect(res.status).toBe(403)
    })
  })

  describe('GET /categorias', () => {
    it('should list categorias with totalTutoriais', async () => {
      vi.mocked(prisma.tutorialCategoria.findMany).mockResolvedValue([
        { ...categoriaMock, _count: { tutoriais: 7 } }
      ] as any)

      const res = await request(app).get('/api/tutoriais/categorias')

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([
        { id: 'cat-1', nome: 'Redes', descricao: null, cor: '#3b82f6', totalTutoriais: 7 }
      ])
    })
  })
})
