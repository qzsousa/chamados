import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { Prisma } from '@prisma/client'
import agendaRoutes from './agenda'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'

/**
 * Estado do usuário autenticado nos testes.
 *
 * `vi.hoisted` porque o factory do `vi.mock` é elevado acima da declaração —
 * sem ele, o mock referenciaria a variável antes da inicialização.
 */
const { usuario } = vi.hoisted(() => ({
  usuario: { nivel: 'ADMIN', filial: 'E.E. TESTE 1' }
}))

vi.mock('../config/prisma', () => ({
  prisma: {
    atribuicaoAgenda: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn()
    },
    usuario: {
      findMany: vi.fn()
    }
  }
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((req: any, _res: any, next: any) => {
    req.user = {
      sub: 'user-1',
      email: 'user@test.com',
      nome: 'Test User',
      nivel: usuario.nivel,
      filial: usuario.filial,
      type: 'access',
      iat: Date.now(),
      exp: Date.now() + 15 * 60 * 1000
    }
    req.userRecord = { id: 'user-1', nivel: usuario.nivel, filial: usuario.filial }
    next()
  }),
  // dashboard.ts (que exporta filtroVisibilidade) também usa attachUserRecord.
  attachUserRecord: vi.fn((_req: any, _res: any, next: any) => next()),
  requireRole: vi.fn((...roles: string[]) => (req: any, res: any, next: any) => {
    if (!roles.includes(usuario.nivel)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão para acessar este recurso' })
    }
    next()
  })
}))

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/agenda', agendaRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

const atribuicao = (over: Record<string, unknown> = {}) => ({
  id: 'ag-1',
  escola: 'E.E. TESTE 1',
  data: new Date('2026-10-19T00:00:00.000Z'),
  tecnicoId: 'tec-1',
  tecnicoNome: 'TECNICO1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over
})

describe('Agenda Routes', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
    usuario.nivel = 'ADMIN'
    usuario.filial = 'E.E. TESTE 1'
  })

  describe('GET /', () => {
    it('lista atribuições no intervalo de datas com a cor do técnico', async () => {
      vi.mocked(prisma.atribuicaoAgenda.findMany).mockResolvedValue([atribuicao()] as any)
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([{ id: 'tec-1', cor: '#3b82f6' }] as any)

      const res = await request(app).get('/api/agenda?de=2026-10-01&ate=2026-10-31')

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].tecnicoCor).toBe('#3b82f6')
      const where = vi.mocked(prisma.atribuicaoAgenda.findMany).mock.calls[0][0].where
      expect(where?.data).toBeDefined()
    })

    it('403 para quem não pode atender a escola pedida', async () => {
      usuario.nivel = 'TECNICO'
      usuario.filial = 'E.E. OUTRA'

      const res = await request(app).get('/api/agenda?escola=E.E. TESTE 1')

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('FORBIDDEN')
    })
  })

  describe('POST /', () => {
    it('403 para quem não tem perfil de scheduling', async () => {
      usuario.nivel = 'TECNICO'

      const res = await request(app)
        .post('/api/agenda')
        .send({ escola: 'E.E. TESTE 1', data: '2026-10-19', tecnicoId: 'tec-1', tecnicoNome: 'TECNICO1' })

      expect(res.status).toBe(403)
    })

    it('409 na duplicidade do mesmo dia', async () => {
      vi.mocked(prisma.atribuicaoAgenda.create).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.10.0',
          meta: { target: ['escola', 'data'] }
        })
      )

      const res = await request(app)
        .post('/api/agenda')
        .send({ escola: 'E.E. TESTE 1', data: '2026-10-19', tecnicoId: 'tec-1', tecnicoNome: 'TECNICO1' })

      expect(res.status).toBe(409)
    })

    it('400 para dados inválidos', async () => {
      const res = await request(app)
        .post('/api/agenda')
        .send({ escola: '', data: 'data-errada', tecnicoId: '', tecnicoNome: '' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })
  })

  describe('DELETE /:id', () => {
    it('404 no DELETE de id inexistente', async () => {
      vi.mocked(prisma.atribuicaoAgenda.delete).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: '5.10.0'
        })
      )

      const res = await request(app).delete('/api/agenda/nao-existe')

      expect(res.status).toBe(404)
    })

    it('remove com sucesso', async () => {
      vi.mocked(prisma.atribuicaoAgenda.delete).mockResolvedValue(atribuicao() as any)

      const res = await request(app).delete('/api/agenda/ag-1')

      expect(res.status).toBe(204)
    })
  })
})
