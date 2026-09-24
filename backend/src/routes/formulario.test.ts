import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import formularioRoutes, { formularioPublicoHandler } from './formulario'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'

vi.mock('../config/prisma', () => ({
  prisma: {
    formularioCategoria: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    formularioPergunta: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  }
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

const categoriaMock = {
  id: 'cat-1',
  chave: 'rede',
  nome: 'Rede',
  descricao: 'Problemas de rede',
  cor: '#1E7FC7',
  ordem: 1,
  ativa: true,
  createdAt: new Date(),
  updatedAt: new Date()
}

const perguntaMock = {
  id: 'perg-1',
  categoriaId: 'cat-1',
  rotulo: 'Qual é o problema de rede?',
  ajuda: null,
  tipo: 'OPCOES',
  obrigatoria: true,
  ordem: 1,
  ativa: true,
  dependeDePerguntaId: null,
  dependeDeOpcao: null,
  opcoes: [{ rotulo: 'Lentidão' }],
  createdAt: new Date(),
  updatedAt: new Date()
}

const createApp = () => {
  const app = express()
  app.use(express.json())
  // espelha index.ts: rota pública antes da parede de auth
  app.get('/api/formulario/publico', formularioPublicoHandler)
  app.use('/api/formulario', formularioRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Formulário Routes', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
    mockNivel = 'ADMIN'
  })

  describe('GET /publico', () => {
    it('should seed defaults when table is empty and return list', async () => {
      vi.mocked(prisma.formularioCategoria.count).mockResolvedValue(0)
      vi.mocked(prisma.formularioCategoria.create).mockResolvedValue(categoriaMock as any)
      vi.mocked(prisma.formularioCategoria.findMany).mockResolvedValue([
        { ...categoriaMock, perguntas: [perguntaMock] }
      ] as any)

      const res = await request(app).get('/api/formulario/publico')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].perguntas[0].id).toBe('perg-1')
      // ids determinísticos no seed (deps apontam para perguntas corretas)
      expect(prisma.formularioCategoria.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          id: 'seed-cat-rede',
          chave: 'rede',
          perguntas: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({
                id: 'seed-perg-rede-2',
                dependeDePerguntaId: 'seed-perg-rede-1',
                dependeDeOpcao: 'Queda total de internet'
              })
            ])
          })
        })
      }))
      // 4 categorias semeadas
      expect(prisma.formularioCategoria.create).toHaveBeenCalledTimes(4)
    })

    it('should return active list without seeding when already populated', async () => {
      vi.mocked(prisma.formularioCategoria.count).mockResolvedValue(4)
      vi.mocked(prisma.formularioCategoria.findMany).mockResolvedValue([
        { ...categoriaMock, perguntas: [perguntaMock] }
      ] as any)

      const res = await request(app).get('/api/formulario/publico')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(prisma.formularioCategoria.create).not.toHaveBeenCalled()
      expect(prisma.formularioCategoria.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { ativa: true },
        orderBy: [{ ordem: 'asc' }, { nome: 'asc' }]
      }))
    })

    it('should continue when seed fails (race between requests)', async () => {
      vi.mocked(prisma.formularioCategoria.count).mockResolvedValue(0)
      vi.mocked(prisma.formularioCategoria.create).mockRejectedValue({ code: 'P2002' })
      vi.mocked(prisma.formularioCategoria.findMany).mockResolvedValue([])

      const res = await request(app).get('/api/formulario/publico')

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
    })
  })

  describe('GET /categorias (admin)', () => {
    it('should list all categorias with perguntas', async () => {
      vi.mocked(prisma.formularioCategoria.findMany).mockResolvedValue([
        { ...categoriaMock, ativa: false, perguntas: [perguntaMock] }
      ] as any)

      const res = await request(app).get('/api/formulario/categorias')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(prisma.formularioCategoria.findMany).toHaveBeenCalledWith(expect.objectContaining({
        include: { perguntas: { orderBy: { ordem: 'asc' } } }
      }))
    })

    it('should return 403 for non-admin', async () => {
      mockNivel = 'TECNICO'

      const res = await request(app).get('/api/formulario/categorias')

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('FORBIDDEN')
      expect(prisma.formularioCategoria.findMany).not.toHaveBeenCalled()
    })
  })

  describe('POST /categorias', () => {
    it('should create categoria and slugify chave from nome', async () => {
      vi.mocked(prisma.formularioCategoria.create).mockResolvedValue(categoriaMock as any)

      const res = await request(app)
        .post('/api/formulario/categorias')
        .send({ nome: 'E-mail institucional', cor: '#C9711A' })

      expect(res.status).toBe(201)
      expect(prisma.formularioCategoria.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ chave: 'e-mail-institucional' })
      }))
    })

    it('should return 409 for duplicate chave', async () => {
      vi.mocked(prisma.formularioCategoria.create).mockRejectedValue({ code: 'P2002' })

      const res = await request(app)
        .post('/api/formulario/categorias')
        .send({ chave: 'rede', nome: 'Rede' })

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('CONFLICT')
      expect(res.body.message).toBe('Já existe uma categoria com essa chave.')
    })

    it('should return 400 for invalid cor', async () => {
      const res = await request(app)
        .post('/api/formulario/categorias')
        .send({ nome: 'Rede', cor: 'azul' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should return 403 for non-admin', async () => {
      mockNivel = 'VISUALIZADOR'

      const res = await request(app)
        .post('/api/formulario/categorias')
        .send({ nome: 'Rede' })

      expect(res.status).toBe(403)
    })
  })

  describe('PATCH /categorias/:id', () => {
    it('should update categoria', async () => {
      vi.mocked(prisma.formularioCategoria.update).mockResolvedValue({ ...categoriaMock, ativa: false } as any)

      const res = await request(app)
        .patch('/api/formulario/categorias/cat-1')
        .send({ ativa: false })

      expect(res.status).toBe(200)
      expect(res.body.ativa).toBe(false)
    })

    it('should return 404 for missing categoria', async () => {
      vi.mocked(prisma.formularioCategoria.update).mockRejectedValue({ code: 'P2025' })

      const res = await request(app)
        .patch('/api/formulario/categorias/inexistente')
        .send({ nome: 'X' })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })
  })

  describe('DELETE /categorias/:id', () => {
    it('should delete categoria (cascade covers perguntas)', async () => {
      vi.mocked(prisma.formularioCategoria.delete).mockResolvedValue(categoriaMock as any)

      const res = await request(app).delete('/api/formulario/categorias/cat-1')

      expect(res.status).toBe(204)
    })

    it('should return 404 for missing categoria', async () => {
      vi.mocked(prisma.formularioCategoria.delete).mockRejectedValue({ code: 'P2025' })

      const res = await request(app).delete('/api/formulario/categorias/inexistente')

      expect(res.status).toBe(404)
    })
  })

  describe('POST /perguntas', () => {
    it('should create pergunta as admin', async () => {
      vi.mocked(prisma.formularioCategoria.findUnique).mockResolvedValue(categoriaMock as any)
      vi.mocked(prisma.formularioPergunta.create).mockResolvedValue(perguntaMock as any)

      const res = await request(app)
        .post('/api/formulario/perguntas')
        .send({
          categoriaId: 'cat-1',
          rotulo: 'Qual é o problema de rede?',
          tipo: 'OPCOES',
          opcoes: [{ rotulo: 'Lentidão' }]
        })

      expect(res.status).toBe(201)
      expect(res.body.id).toBe('perg-1')
    })

    it('should return 400 for OPCOES without opcoes', async () => {
      const res = await request(app)
        .post('/api/formulario/perguntas')
        .send({ categoriaId: 'cat-1', rotulo: 'Qual?', tipo: 'OPCOES' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
      expect(prisma.formularioPergunta.create).not.toHaveBeenCalled()
    })

    it('should return 400 for TEXTO with opcoes', async () => {
      const res = await request(app)
        .post('/api/formulario/perguntas')
        .send({ categoriaId: 'cat-1', rotulo: 'RG', tipo: 'TEXTO', opcoes: [{ rotulo: 'x' }] })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for dependeDeOpcao without dependeDePerguntaId', async () => {
      const res = await request(app)
        .post('/api/formulario/perguntas')
        .send({ categoriaId: 'cat-1', rotulo: 'RG', tipo: 'TEXTO', dependeDeOpcao: 'PortalNet' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should return 404 when categoria does not exist', async () => {
      vi.mocked(prisma.formularioCategoria.findUnique).mockResolvedValue(null)

      const res = await request(app)
        .post('/api/formulario/perguntas')
        .send({ categoriaId: 'cat-x', rotulo: 'RG', tipo: 'TEXTO' })

      expect(res.status).toBe(404)
      expect(res.body.message).toBe('Categoria não encontrada.')
    })

    it('should return 400 when dependency belongs to another categoria', async () => {
      vi.mocked(prisma.formularioCategoria.findUnique).mockResolvedValue(categoriaMock as any)
      vi.mocked(prisma.formularioPergunta.findUnique).mockResolvedValue({ ...perguntaMock, id: 'perg-outra', categoriaId: 'cat-2' } as any)

      const res = await request(app)
        .post('/api/formulario/perguntas')
        .send({
          categoriaId: 'cat-1',
          rotulo: 'Detalhe',
          tipo: 'TEXTO',
          dependeDePerguntaId: 'perg-outra',
          dependeDeOpcao: 'Lentidão'
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toBe('A pergunta da qual depende deve pertencer à mesma categoria.')
      expect(prisma.formularioPergunta.create).not.toHaveBeenCalled()
    })

    it('should create pergunta with valid dependency in same categoria', async () => {
      vi.mocked(prisma.formularioCategoria.findUnique).mockResolvedValue(categoriaMock as any)
      vi.mocked(prisma.formularioPergunta.findUnique).mockResolvedValue(perguntaMock as any)
      vi.mocked(prisma.formularioPergunta.create).mockResolvedValue({ ...perguntaMock, id: 'perg-2', dependeDePerguntaId: 'perg-1' } as any)

      const res = await request(app)
        .post('/api/formulario/perguntas')
        .send({
          categoriaId: 'cat-1',
          rotulo: 'Detalhe',
          tipo: 'TEXTO_LONGO',
          dependeDePerguntaId: 'perg-1',
          dependeDeOpcao: 'Lentidão'
        })

      expect(res.status).toBe(201)
    })

    it('should return 403 for non-admin', async () => {
      mockNivel = 'TECNICO'

      const res = await request(app)
        .post('/api/formulario/perguntas')
        .send({ categoriaId: 'cat-1', rotulo: 'RG', tipo: 'TEXTO' })

      expect(res.status).toBe(403)
    })
  })

  describe('PATCH /perguntas/:id', () => {
    it('should update pergunta', async () => {
      vi.mocked(prisma.formularioPergunta.update).mockResolvedValue({ ...perguntaMock, ativa: false } as any)

      const res = await request(app)
        .patch('/api/formulario/perguntas/perg-1')
        .send({ ativa: false })

      expect(res.status).toBe(200)
      expect(res.body.ativa).toBe(false)
    })

    it('should return 404 for missing pergunta', async () => {
      vi.mocked(prisma.formularioPergunta.update).mockRejectedValue({ code: 'P2025' })

      const res = await request(app)
        .patch('/api/formulario/perguntas/inexistente')
        .send({ rotulo: 'Novo' })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })
  })

  describe('DELETE /perguntas/:id', () => {
    it('should delete pergunta', async () => {
      vi.mocked(prisma.formularioPergunta.delete).mockResolvedValue(perguntaMock as any)

      const res = await request(app).delete('/api/formulario/perguntas/perg-1')

      expect(res.status).toBe(204)
    })

    it('should return 404 for missing pergunta', async () => {
      vi.mocked(prisma.formularioPergunta.delete).mockRejectedValue({ code: 'P2025' })

      const res = await request(app).delete('/api/formulario/perguntas/inexistente')

      expect(res.status).toBe(404)
    })
  })
})
