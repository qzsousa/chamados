import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'

vi.mock('../config/prisma', () => ({
  prisma: {
    usuario: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn()
    },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}))

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
    compare: vi.fn((plain: string, hash: string) => Promise.resolve(plain === 'correct-password' || hash === 'hashed-correct-password')),
    hash: vi.fn((plain: string) => Promise.resolve(`hashed-${plain}`))
  },
  compare: vi.fn((plain: string, hash: string) => Promise.resolve(plain === 'correct-password' || hash === 'hashed-correct-password')),
  hash: vi.fn((plain: string) => Promise.resolve(`hashed-${plain}`))
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((req: any, _res: any, next: any) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return _res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token de acesso não fornecido' })
    }
    const token = authHeader.slice(7)
    if (token.startsWith('access-token-')) {
      req.user = { sub: token.replace('access-token-', ''), type: 'access', iat: Date.now(), exp: Date.now() + 15 * 60 * 1000, email: 'test@test.com', nome: 'Test User', nivel: 'ADMIN', filial: 'FILIAL1' }
      return next()
    }
    return _res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token inválido ou expirado' })
  }),
  requireRole: vi.fn((...roles: string[]) => (req: any, _res: any, next: any) => {
    if (!req.user) {
      return _res.status(401).json({ error: 'UNAUTHORIZED', message: 'Usuário não autenticado' })
    }
    req.userRecord = { id: req.user.sub, email: 'test@test.com', nome: 'Test User', nivel: req.user.nivel, filial: req.user.filial, status: 'ATIVO', primeiroLogin: false }
    if (!roles.includes(req.userRecord.nivel)) {
      return _res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão para acessar este recurso' })
    }
    next()
  }),
  attachUserRecord: vi.fn((req: any, _res: any, next: any) => {
    if (!req.user) return next()
    req.userRecord = { id: req.user.sub, email: 'test@test.com', nome: 'Test User', nivel: req.user.nivel, filial: req.user.filial, status: 'ATIVO', primeiroLogin: false }
    next()
  })
}))

import authRoutes from './auth'

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/auth', authRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Auth Routes', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /login', () => {
    it('should return 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid', senha: 'password123' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should return 401 for non-existent user', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', senha: 'password123' })

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('UNAUTHORIZED')
    })

    it('should return 401 for inactive user', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        senhaHash: 'hashed-password123',
        status: 'INATIVO',
        nivel: 'ADMIN',
        filial: 'FILIAL1',
        nome: 'Test User',
        primeiroLogin: false
      })

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', senha: 'password123' })

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('UNAUTHORIZED')
    })

    it('should return 401 for wrong password', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        senhaHash: 'hashed-correct-password',
        status: 'ATIVO',
        nivel: 'ADMIN',
        filial: 'FILIAL1',
        nome: 'Test User',
        primeiroLogin: false
      })

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', senha: 'wrong-password' })

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('UNAUTHORIZED')
    })

    it('should return accessToken, refreshToken, and user on successful login', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        senhaHash: 'hashed-password123',
        status: 'ATIVO',
        nivel: 'ADMIN',
        filial: 'FILIAL1',
        nome: 'Test User',
        primeiroLogin: true
      })
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({})

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', senha: 'password123' })

      expect(res.status).toBe(200)
      expect(res.body.accessToken).toBeDefined()
      expect(res.body.refreshToken).toBeDefined()
      expect(res.body.user).toEqual({
        id: 'user-1',
        email: 'test@test.com',
        nome: 'Test User',
        nivel: 'ADMIN',
        filial: 'FILIAL1',
        primeiroLogin: true
      })
      expect(res.body.primeiroLogin).toBe(true)
      expect(res.headers['set-cookie']).toBeDefined()
    })
  })

  describe('POST /refresh', () => {
    it('should return 401 when no refresh token provided', async () => {
      const res = await request(app).post('/api/auth/refresh')

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('UNAUTHORIZED')
    })

    it('should return 401 for invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['refreshToken=invalid-token'])

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('UNAUTHORIZED')
    })

    it('should return 401 when refresh token not found in DB', async () => {
      vi.mocked(prisma.refreshToken.findFirst).mockResolvedValue(null)

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['refreshToken=refresh-token-user-1'])

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('UNAUTHORIZED')
    })

    it('should return 401 for expired or invalid token', async () => {
      vi.mocked(prisma.refreshToken.findFirst).mockResolvedValue({
        id: 'token-1',
        tokenHash: 'hashed-refresh-token-user-1',
        usuarioId: 'user-1',
        expiraEm: new Date(Date.now() - 1000)
      })

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['refreshToken=refresh-token-user-1'])

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('UNAUTHORIZED')
    })

    it('should return new tokens on successful refresh', async () => {
      vi.mocked(prisma.refreshToken.findFirst).mockResolvedValue({
        id: 'token-1',
        tokenHash: 'hashed-refresh-token-user-1',
        usuarioId: 'user-1',
        expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      })
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        nome: 'Test User',
        nivel: 'ADMIN',
        filial: 'FILIAL1',
        primeiroLogin: false,
        status: 'ATIVO'
      })
      vi.mocked(prisma.refreshToken.delete).mockResolvedValue({})
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({})

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['refreshToken=refresh-token-user-1'])

      expect(res.status).toBe(200)
      expect(res.body.accessToken).toBeDefined()
      expect(res.body.refreshToken).toBeDefined()
      expect(res.body.user.id).toBe('user-1')
    })
  })

  describe('POST /logout', () => {
    it('should clear cookie and return success', async () => {
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 1 })

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer access-token-user-1')
        .set('Cookie', ['refreshToken=refresh-token-user-1'])

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.headers['set-cookie'][0]).toContain('Max-Age=0')
    })
  })

  describe('GET /me', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me')

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('UNAUTHORIZED')
    })

    it('should return user data', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        nome: 'Test User',
        nivel: 'ADMIN',
        filial: 'FILIAL1',
        status: 'ATIVO',
        primeiroLogin: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer access-token-user-1')

      expect(res.status).toBe(200)
      expect(res.body.id).toBe('user-1')
      expect(res.body.email).toBe('test@test.com')
    })
  })

  describe('POST /change-password', () => {
    it('should return 400 for invalid data', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', 'Bearer access-token-user-1')
        .send({ senhaAtual: 'old', novaSenha: 'short' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should return 401 for wrong current password', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
        id: 'user-1',
        senhaHash: 'hashed-correct-password'
      })

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', 'Bearer access-token-user-1')
        .send({ senhaAtual: 'wrong-password', novaSenha: 'NewPassword123!' })

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('UNAUTHORIZED')
    })

    it('should update password and invalidate refresh tokens', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
        id: 'user-1',
        senhaHash: 'hashed-correct-password'
      })
      vi.mocked(prisma.usuario.update).mockResolvedValue({})
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 1 })

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', 'Bearer access-token-user-1')
        .send({ senhaAtual: 'correct-password', novaSenha: 'NewPassword123!' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(prisma.usuario.update).toHaveBeenCalled()
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { usuarioId: 'user-1' } })
    })
  })

  describe('POST /admin/gerar-senha-temporaria', () => {
    it('should return 404 for non-existent user', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)

      const res = await request(app)
        .post('/api/auth/admin/gerar-senha-temporaria')
        .set('Authorization', 'Bearer access-token-admin-1')
        .send({ email: 'nonexistent@test.com' })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })

    it('should generate temporary password for existing user', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        senhaHash: 'old-hash'
      })
      vi.mocked(prisma.usuario.update).mockResolvedValue({})
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 1 })

      const res = await request(app)
        .post('/api/auth/admin/gerar-senha-temporaria')
        .set('Authorization', 'Bearer access-token-admin-1')
        .send({ email: 'user@test.com' })

      expect(res.status).toBe(200)
      expect(res.body.senhaTemporaria).toBeDefined()
      expect(typeof res.body.senhaTemporaria).toBe('string')
      expect(res.body.senhaTemporaria.length).toBeGreaterThanOrEqual(8)
    })
  })
})