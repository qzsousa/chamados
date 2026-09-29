import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import escolaRoutes from './escolas'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'
import { listarGruposUnidades } from '../services/normalization'

vi.mock('../config/prisma', () => ({
  prisma: {
    escola: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn()
    },
    inventario: {
      findMany: vi.fn()
    },
    usuario: {
      findMany: vi.fn()
    },
    chamado: {
      groupBy: vi.fn()
    }
  }
}))

vi.mock('../services/normalization', () => ({
  normalizarNomeEscola: vi.fn((nome: string) => nome.toUpperCase().replace(/[^A-Z0-9]/g, '')),
  getMapaTecnicos: vi.fn(() => ({ ESCOLA1: 'TECNICO1', ESCOLA2: 'TECNICO2' })),
  getTecnicoPorEscola: vi.fn(() => 'TECNICO1'),
  listarGruposUnidades: vi.fn(() => [
    { nome: 'E.E. TESTE 1', grupo: 'E.E. TESTE 1 / E.E. TESTE 2', irma: 'E.E. TESTE 2' },
  ]),
  listarUnidadesIndividuais: vi.fn(() => [
    { nome: 'E.E. TESTE 1', grupo: 'E.E. TESTE 1 / E.E. TESTE 2', irma: 'E.E. TESTE 2' },
    { nome: 'E.E. TESTE 2', grupo: 'E.E. TESTE 1 / E.E. TESTE 2', irma: 'E.E. TESTE 1' }
  ]),
  NOMES_PADRONIZADOS: ['E.E. TESTE 1', 'E.E. TESTE 2']
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((req: any, _res: any, next: any) => {
    req.user = { sub: 'user-1', email: 'user@test.com', nome: 'Test User', nivel: 'ADMIN', filial: 'FILIAL1', type: 'access', iat: Date.now(), exp: Date.now() + 15 * 60 * 1000 }
    next()
  }),
  requireRole: vi.fn((..._roles: string[]) => (_req: any, _res: any, next: any) => next())
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

  describe('GET /painel', () => {
    it('should return uma linha por prédio (mãe/filha não duplica) com inventário e contadores', async () => {
      vi.mocked(prisma.inventario.findMany).mockResolvedValue([
        { escola: { nome: 'E.E. TESTE 1 / E.E. TESTE 2' }, status: 'CONCLUIDO' }
      ] as any)
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([{ filial: 'E.E. TESTE 1' }] as any)
      vi.mocked(prisma.chamado.groupBy).mockResolvedValue([
        { unidade: 'E.E. TESTE 1', status: 'ABERTO', _count: 2 },
        { unidade: 'E.E. TESTE 1 / E.E. TESTE 2', status: 'RESOLVIDO', _count: 3 }
      ] as any)

      const res = await request(app).get('/api/escolas/painel')

      expect(res.status).toBe(200)
      // 1 prédio = 1 linha, mesmo com mãe E filha
      expect(res.body).toHaveLength(1)
      const u1 = res.body[0]
      expect(u1.nome).toBe('E.E. TESTE 1')
      expect(u1.grupo).toBe('E.E. TESTE 1 / E.E. TESTE 2')
      expect(u1.irma).toBe('E.E. TESTE 2')
      expect(u1.tecnico).toBe('TECNICO1')
      expect(u1.inventarioStatus).toBe('CONCLUIDO')
      expect(u1.usuariosAtivos).toBe(1)
      // chamado individual da mãe (2 abertos) + composto do grupo (3 resolvidos),
      // contando o composto UMA vez
      expect(u1.chamadosTotal).toBe(5)
      expect(u1.chamadosAbertos).toBe(2)
    })

    it('deve somar chamado registrado no nome da irmã no total do prédio', async () => {
      vi.mocked(prisma.inventario.findMany).mockResolvedValue([] as any)
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([
        { filial: 'E.E. TESTE 1' },
        { filial: 'E.E. TESTE 2' },
      ] as any)
      vi.mocked(prisma.chamado.groupBy).mockResolvedValue([
        { unidade: 'E.E. TESTE 1', status: 'ABERTO', _count: 1 },
        { unidade: 'E.E. TESTE 2', status: 'ABERTO', _count: 4 },
      ] as any)

      const res = await request(app).get('/api/escolas/painel')

      expect(res.body).toHaveLength(1)
      // 1 da mãe + 4 da filha = 5 no prédio (antes a filha tinha linha própria)
      expect(res.body[0].chamadosTotal).toBe(5)
      expect(res.body[0].chamadosAbertos).toBe(5)
      // usuário da irmã entra uma vez só
      expect(res.body[0].usuariosAtivos).toBe(2)
    })

    it('não deve casar chamado de outra escola por semelhança de prefixo', async () => {
      vi.mocked(listarGruposUnidades).mockReturnValue([
        { nome: 'E.E. VILA BELA', grupo: 'E.E. VILA BELA', irma: null },
      ] as any)
      vi.mocked(prisma.inventario.findMany).mockResolvedValue([] as any)
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([] as any)
      vi.mocked(prisma.chamado.groupBy).mockResolvedValue([
        { unidade: 'E.E. VILA', status: 'ABERTO', _count: 7 },
      ] as any)

      const res = await request(app).get('/api/escolas/painel')

      // "E.E. VILA" está contido em "E.E. VILA BELA", mas é outra escola:
      // o matcher por grupo compara por igualdade, então não entra.
      expect(res.body[0].chamadosTotal).toBe(0)
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