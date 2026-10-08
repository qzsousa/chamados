import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import usuarioRoutes from './usuarios'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'
import { authMiddleware } from '../middleware/auth'

vi.mock('../config/prisma', () => ({
  prisma: {
    usuario: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    refreshToken: {
      deleteMany: vi.fn()
    },
codigoPrimeiroAcesso: {
      create: vi.fn(),
      deleteMany: vi.fn()
    },
    // Usados por `validarEscopo`: o escopo só é aceito se cada tipo existir
    // de fato no formulário ativo.
    formularioCategoria: {
      findMany: vi.fn()
    },
    formularioPergunta: {
      findFirst: vi.fn()
    }
  }
}))

// `importOriginal` é obrigatório: o serviço de primeiro acesso usa `hashToken`
// deste módulo. Um mock de fábrica sem o original deixaria `hashToken`
// indefinido e o código nem seria gerado.
vi.mock('../utils/tokens', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return {
    ...original,
    passwordPolicy: {
      generateTemp: vi.fn(() => 'TempPass123!'),
      validate: vi.fn(() => ({ valid: true, errors: [] }))
    }
  }
})

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(() => Promise.resolve('hashed-password'))
  },
  hash: vi.fn(() => Promise.resolve('hashed-password'))
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((req: any, _res: any, next: any) => {
    req.user = { sub: 'admin-1', email: 'admin@test.com', nome: 'Admin User', nivel: 'ADMIN', filial: 'FILIAL1', type: 'access', iat: Date.now(), exp: Date.now() + 15 * 60 * 1000 }
    next()
  }),
  requireRole: vi.fn((...roles: string[]) => (req: any, _res: any, next: any) => {
    req.userRecord = { id: 'admin-1', email: 'admin@test.com', nome: 'Admin User', nivel: 'ADMIN', filial: 'FILIAL1', status: 'ATIVO', primeiroLogin: false }
    if (!roles.includes(req.userRecord.nivel)) {
      return _res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão' })
    }
    next()
  })
}))

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/usuarios', usuarioRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Usuários Routes (ADMIN)', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
  })

  describe('GET /', () => {
    it('should return paginated users', async () => {
      vi.mocked(prisma.usuario.count).mockResolvedValue(2)
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([
        { id: 'user-1', email: 'user1@test.com', nome: 'User 1', nivel: 'TECNICO', filial: 'FILIAL1', status: 'ATIVO', primeiroLogin: false, createdAt: new Date(), updatedAt: new Date() },
        { id: 'user-2', email: 'user2@test.com', nome: 'User 2', nivel: 'GESTOR', filial: 'FILIAL2', status: 'ATIVO', primeiroLogin: true, createdAt: new Date(), updatedAt: new Date() }
      ])

      const res = await request(app).get('/api/usuarios')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
      expect(res.body.meta).toEqual({ total: 2, page: 1, limit: 20, totalPages: 1 })
    })

    it('should filter by search', async () => {
      vi.mocked(prisma.usuario.count).mockResolvedValue(1)
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([
        { id: 'user-1', email: 'user1@test.com', nome: 'User 1', nivel: 'TECNICO', filial: 'FILIAL1', status: 'ATIVO', primeiroLogin: false, createdAt: new Date(), updatedAt: new Date() }
      ])

      const res = await request(app).get('/api/usuarios?search=user1')

      expect(res.status).toBe(200)
      expect(prisma.usuario.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ email: expect.any(Object) }),
            expect.objectContaining({ nome: expect.any(Object) })
          ])
        })
      }))
    })

    it('should filter by nivel and status', async () => {
      vi.mocked(prisma.usuario.count).mockResolvedValue(1)
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([])

      const res = await request(app).get('/api/usuarios?nivel=TECNICO&status=ATIVO')

      expect(res.status).toBe(200)
      expect(prisma.usuario.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ nivel: 'TECNICO', status: 'ATIVO' })
      }))
    })

    it('should filter by unidade', async () => {
      vi.mocked(prisma.usuario.count).mockResolvedValue(1)
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([])

      const res = await request(app).get('/api/usuarios?filial=' + encodeURIComponent('E.E. ALCIDES BOSCOLO'))

      expect(res.status).toBe(200)
      expect(prisma.usuario.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          // `contains` e não igualdade: o TECNICO tem várias unidades na mesma
          // linha de `filial`, separadas por vírgula.
          AND: [{ filial: { contains: 'E.E. ALCIDES BOSCOLO', mode: 'insensitive' } }]
        })
      }))
    })

    it('combina busca e unidade sem disputarem o mesmo OR', async () => {
      vi.mocked(prisma.usuario.count).mockResolvedValue(1)
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([])

      await request(app).get('/api/usuarios?search=maria&filial=' + encodeURIComponent('E.E. A'))

      const { where } = vi.mocked(prisma.usuario.findMany).mock.calls[0][0] as any
      // A busca continua no OR de sempre...
      expect(where.OR).toHaveLength(2)
      // ...e a unidade entra à parte, senão um dos dois anularia o outro.
      expect(where.AND).toEqual([{ filial: { contains: 'E.E. A', mode: 'insensitive' } }])
    })

    it('NÃO deixa o GESTOR ampliar o escopo passando outra unidade no filtro', async () => {
      vi.mocked(authMiddleware).mockImplementationOnce(((req: any, _res: any, next: any) => {
        const gestor = { sub: 'g-1', email: 'gestor@test.com', nome: 'Gestor', nivel: 'GESTOR', filial: 'FILIAL1', type: 'access', iat: Date.now(), exp: Date.now() + 900000 }
        req.user = gestor
        req.userRecord = { id: 'g-1', ...gestor, status: 'ATIVO', primeiroLogin: false }
        next()
      }) as any)
      vi.mocked(prisma.usuario.count).mockResolvedValue(1)
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([])

      // Tentativa de escapar: pedir os usuários da FILIAL2 pelo filtro de unidade.
      const res = await request(app).get('/api/usuarios?filial=FILIAL2')

      expect(res.status).toBe(200)
      const { where } = vi.mocked(prisma.usuario.findMany).mock.calls[0][0] as any
      // Continua preso na própria filial...
      expect(where.filial).toBe('FILIAL1')
      // ...e o parâmetro não entrou na consulta.
      expect(JSON.stringify(where)).not.toContain('FILIAL2')
    })

    it('should respect pagination limits', async () => {
      vi.mocked(prisma.usuario.count).mockResolvedValue(100)
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([])

      const res = await request(app).get('/api/usuarios?page=3&limit=50')

      expect(res.status).toBe(200)
      expect(res.body.meta).toEqual({ total: 100, page: 3, limit: 50, totalPages: 2 })
      expect(prisma.usuario.findMany).toHaveBeenCalledWith(expect.objectContaining({
        skip: 100,
        take: 50
      }))
    })
  })

  describe('POST /', () => {
    it('should return 409 for existing email', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ id: 'existing' })

      const res = await request(app)
        .post('/api/usuarios')
        .send({ email: 'existing@test.com', nome: 'New User', nivel: 'TECNICO', filial: 'FILIAL1' })

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('deve devolver o código de primeiro acesso (e não uma senha pronta)', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.usuario.create).mockResolvedValue({
        id: 'new-user',
        email: 'new@test.com',
        nome: 'New User',
        nivel: 'TECNICO',
        filial: 'FILIAL1',
        status: 'ATIVO',
        primeiroLogin: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      vi.mocked(prisma.codigoPrimeiroAcesso.deleteMany).mockResolvedValue({ count: 0 })
      vi.mocked(prisma.codigoPrimeiroAcesso.create).mockResolvedValue({})

      const res = await request(app)
        .post('/api/usuarios')
        .send({ email: 'new@test.com', nome: 'New User', nivel: 'TECNICO', filial: 'FILIAL1' })

      expect(res.status).toBe(201)
      expect(res.body.id).toBe('new-user')
      // A senha DEFINITIVA é escolhida pela pessoa, no primeiro acesso. O que o
      // ADMIN recebe é o código que autoriza essa escolha.
      expect(res.body.codigoPrimeiroAcesso).toMatch(/^\d{6}$/)
      expect(res.body.senhaTemporaria).toBeUndefined()
      // O código em claro NUNCA vai para o banco — só o SHA-256.
      const gravado = vi.mocked(prisma.codigoPrimeiroAcesso.create).mock.calls[0][0] as any
      expect(gravado.data.codigoHash).toMatch(/^[a-f0-9]{64}$/)
      expect(gravado.data.codigoHash).not.toBe(res.body.codigoPrimeiroAcesso)

      expect(prisma.usuario.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@test.com',
          nome: 'New User',
          nivel: 'TECNICO',
          filial: 'FILIAL1',
          primeiroLogin: true
        })
      }))
    })
  })

  describe('GET /:id', () => {
    it('should return 404 for non-existent user', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)

      const res = await request(app).get('/api/usuarios/non-existent')

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })

    it('should return user data', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        nome: 'User',
        nivel: 'TECNICO',
        filial: 'FILIAL1',
        status: 'ATIVO',
        primeiroLogin: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const res = await request(app).get('/api/usuarios/user-1')

      expect(res.status).toBe(200)
      expect(res.body.id).toBe('user-1')
      expect(res.body.email).toBe('user@test.com')
    })
  })

  describe('PATCH /:id', () => {
    it('should return 404 for non-existent user', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)

      const res = await request(app)
        .patch('/api/usuarios/non-existent')
        .send({ nome: 'Updated' })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })

    it.skip('should return 409 for duplicate email', async () => {
      let callCount = 0
      prisma.usuario.findUnique.mockImplementation(async (args: any) => {
        callCount++
        if (callCount === 1) {
          return { id: 'user-1', email: 'user@test.com' }
        }
        if (callCount === 2) {
          return { id: 'other-user', email: 'other@test.com' }
        }
        return null
      })

      const res = await request(app)
        .patch('/api/usuarios/user-1')
        .send({ email: 'other@test.com' })

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('VALIDATION_ERROR')
      expect(callCount).toBe(2)
    })

    it('should update user', async () => {
      vi.mocked(prisma.usuario.findUnique)
        .mockResolvedValueOnce({ id: 'user-1', email: 'user@test.com' })
        .mockResolvedValueOnce(null)
      vi.mocked(prisma.usuario.update).mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        nome: 'Updated Name',
        nivel: 'TECNICO',
        filial: 'FILIAL1',
        status: 'ATIVO',
        primeiroLogin: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const res = await request(app)
        .patch('/api/usuarios/user-1')
        .send({ nome: 'Updated Name' })

      expect(res.status).toBe(200)
      expect(res.body.nome).toBe('Updated Name')
    })

    it('should delete refresh tokens when status changes to INATIVO', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ id: 'user-1', email: 'user@test.com' })
      vi.mocked(prisma.usuario.update).mockResolvedValue({ id: 'user-1', status: 'INATIVO' })
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 1 })

      const res = await request(app)
        .patch('/api/usuarios/user-1')
        .send({ status: 'INATIVO' })

      expect(res.status).toBe(200)
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { usuarioId: 'user-1' } })
    })
  })

  describe('DELETE /:id', () => {
    it('should return 404 for non-existent user', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)

      const res = await request(app).delete('/api/usuarios/non-existent')

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })

    it('should return 400 when trying to delete self', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ id: 'admin-1' })

      const res = await request(app).delete('/api/usuarios/admin-1')

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should deactivate user and delete refresh tokens', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ id: 'user-1' })
      vi.mocked(prisma.usuario.update).mockResolvedValue({ id: 'user-1', status: 'INATIVO' })
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 1 })

      const res = await request(app).delete('/api/usuarios/user-1')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'INATIVO' }
      })
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { usuarioId: 'user-1' } })
    })
  })

  /* ---- Escopo de tipos (conta que atende só certos tipos) ---- */
  describe('escopoTipos', () => {
    beforeEach(() => {
      vi.mocked(prisma.formularioCategoria.findMany).mockResolvedValue([
        { chave: 'sistemas', nome: 'Sistemas' },
        { chave: 'rede', nome: 'Rede' },
        { chave: 'email', nome: 'E-mail institucional' },
      ] as any)
      vi.mocked(prisma.formularioPergunta.findFirst).mockResolvedValue({ id: 'p1' } as any)
    })

    const novoUsuario = {
      email: 'novo@test.com',
      nome: 'Novo',
      nivel: 'TECNICO',
      filial: 'E.E. TESTE',
      escopoTipos: ['sistemas::PortalNet', 'sistemas::SEI'],
    }

    it('ADMIN cria usuário com escopo gravado', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.usuario.create).mockResolvedValue({
        id: 'u1',
        email: 'novo@test.com',
        nome: 'Novo',
        nivel: 'TECNICO',
        filial: 'E.E. TESTE',
        status: 'ATIVO',
        primeiroLogin: true,
        escopoTipos: ['sistemas::PortalNet', 'sistemas::SEI'],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const res = await request(app).post('/api/usuarios').send(novoUsuario)

      expect(res.status).toBe(201)
      expect(res.body.escopoTipos).toEqual(['sistemas::PortalNet', 'sistemas::SEI'])
      expect(vi.mocked(prisma.usuario.create).mock.calls[0][0].data.escopoTipos).toEqual([
        'sistemas::PortalNet',
        'sistemas::SEI',
      ])
    })

    it('ADMIN cria sem escopo quando não manda o campo', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.usuario.create).mockResolvedValue({ id: 'u1' } as any)

      const { escopoTipos, ...semEscopo } = novoUsuario
      const res = await request(app).post('/api/usuarios').send(semEscopo)

      expect(res.status).toBe(201)
      expect(vi.mocked(prisma.usuario.create).mock.calls[0][0].data.escopoTipos).toEqual([])
    })

    it('recusa tipo que não existe no formulário (400, não grava)', async () => {
      vi.mocked(prisma.formularioPergunta.findFirst).mockResolvedValue(null as any)
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)

      const res = await request(app)
        .post('/api/usuarios')
        .send({ ...novoUsuario, escopoTipos: ['sistemas::PortalNetX'] })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('sistemas::PortalNetX')
      expect(prisma.usuario.create).not.toHaveBeenCalled()
    })

    it('recusa categoria inexistente', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)

      const res = await request(app)
        .post('/api/usuarios')
        .send({ ...novoUsuario, escopoTipos: ['categoriaFantasma::X'] })

      expect(res.status).toBe(400)
      expect(prisma.usuario.create).not.toHaveBeenCalled()
    })

    it('recusa valor sem o separador categoria::tipo', async () => {
      const res = await request(app)
        .post('/api/usuarios')
        .send({ ...novoUsuario, escopoTipos: ['soTexto'] })

      expect(res.status).toBe(400)
      expect(prisma.usuario.create).not.toHaveBeenCalled()
    })

    it('categoria inteira (rótulo vazio) é aceita sem consultar pergunta', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.usuario.create).mockResolvedValue({ id: 'u1' } as any)

      const res = await request(app)
        .post('/api/usuarios')
        .send({ ...novoUsuario, escopoTipos: ['email::'] })

      expect(res.status).toBe(201)
      expect(prisma.formularioPergunta.findFirst).not.toHaveBeenCalled()
    })

    it('PATCH sem escopo no corpo preserva o que está gravado', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
        id: 'user-1',
        nivel: 'TECNICO',
        filial: 'FILIAL1',
        escopoTipos: ['sistemas::SEI'],
      } as any)
      vi.mocked(prisma.usuario.update).mockResolvedValue({ id: 'user-1' } as any)

      await request(app).patch('/api/usuarios/user-1').send({ nome: 'Outro nome' })

      // `undefined` = não mexe; um `[]` aqui apagaria o escopo sem querer.
      expect(vi.mocked(prisma.usuario.update).mock.calls[0][0].data.escopoTipos).toBeUndefined()
    })

    it('PATCH com lista vazia limpa o escopo (volta a ver tudo)', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ id: 'user-1', nivel: 'TECNICO' } as any)
      vi.mocked(prisma.usuario.update).mockResolvedValue({ id: 'user-1' } as any)

      await request(app).patch('/api/usuarios/user-1').send({ escopoTipos: [] })

      expect(vi.mocked(prisma.usuario.update).mock.calls[0][0].data.escopoTipos).toEqual([])
    })

    /**
     * O GESTOR tem o campo DESCARTADO, não recusado — igual já acontece com
     * `nivel` e `filial`, que viram `undefined` e seguem o resto do PATCH. É
     * "fail closed": nenhuma configuração de escopo é concedida. A tela de
     * usuários esconde as checkboxes para não-ADMIN, então o caso só sai por
     * chamada direta à API.
     */
    it('GESTOR tenta definir escopo e o campo é ignorado', async () => {
      const gestor = { sub: 'g-1', email: 'gestor@test.com', nome: 'Gestor', nivel: 'GESTOR', filial: 'FILIAL1', type: 'access', iat: Date.now(), exp: Date.now() + 900000 }
      vi.mocked(authMiddleware).mockImplementation(((req: any, _res: any, next: any) => {
        req.user = gestor
        req.userRecord = { id: 'g-1', ...gestor, status: 'ATIVO', primeiroLogin: false, escopoTipos: [] }
        next()
      }) as any)
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
        id: 'user-1',
        nivel: 'VISUALIZADOR',
        filial: 'FILIAL1',
      } as any)
      vi.mocked(prisma.usuario.update).mockResolvedValue({ id: 'user-1' } as any)

      const res = await request(app)
        .patch('/api/usuarios/user-1')
        .send({ nome: 'Renomeado', escopoTipos: ['sistemas::SEI'] })

      expect(res.status).toBe(200)
      const data = vi.mocked(prisma.usuario.update).mock.calls[0][0].data
      expect(data.escopoTipos).toBeUndefined()
      // E o resto do PATCH do Gestor continua valendo.
      expect(data.nome).toBe('Renomeado')
    })

    it('GESTOR não amplia acesso: o escopo do alvo não é tocado', async () => {
      const gestor = { sub: 'g-1', email: 'gestor@test.com', nome: 'Gestor', nivel: 'GESTOR', filial: 'FILIAL1', type: 'access', iat: Date.now(), exp: Date.now() + 900000 }
      vi.mocked(authMiddleware).mockImplementation(((req: any, _res: any, next: any) => {
        req.user = gestor
        req.userRecord = { id: 'g-1', ...gestor, status: 'ATIVO', primeiroLogin: false, escopoTipos: [] }
        next()
      }) as any)
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
        id: 'user-1',
        nivel: 'VISUALIZADOR',
        filial: 'FILIAL1',
        escopoTipos: ['sistemas::SEI'],
      } as any)
      vi.mocked(prisma.usuario.update).mockResolvedValue({ id: 'user-1' } as any)

      await request(app).patch('/api/usuarios/user-1').send({ nome: 'Renomeado' })

      expect(vi.mocked(prisma.usuario.update).mock.calls[0][0].data.escopoTipos).toBeUndefined()
    })
  })
})