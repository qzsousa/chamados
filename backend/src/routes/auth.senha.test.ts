/**
 * Regressão: o corpo do login NÃO pode carregar segredo do usuário.
 *
 * O `POST /login` respondia o registro do Prisma inteiro (via `...user`),
 * então `senhaHash` — o hash bcrypt da senha — ia para o navegador de qualquer
 * pessoa que logasse. Este teste trava o comportamento: a resposta só pode
 * conter os campos da allow-list de `publicarUsuario`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import { prisma } from '../config/prisma'

vi.mock('../config/prisma', () => ({
  prisma: {
    usuario: { findUnique: vi.fn() },
    refreshToken: { create: vi.fn() },
  },
}))

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn(() => Promise.resolve(true)) },
  compare: vi.fn(() => Promise.resolve(true)),
  hash: vi.fn((p: string) => Promise.resolve(`hashed-${p}`)),
}))

import authRoutes from './auth'

const SENHA_HASH = '$2a$12$hashQueNaoPodeSairParaOBrowser'
const REGISTRO_COMPLETO = {
  id: 'user-1',
  email: 'teste@educacao.sp.gov.br',
  nome: 'Usuário Teste',
  nivel: 'ADMIN',
  filial: 'E.E. TESTE',
  status: 'ATIVO',
  primeiroLogin: true,
  senhaHash: SENHA_HASH,
  refreshTokenHash: 'sha256-de-outro-token',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
}

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/auth', authRoutes)
  return app
}

describe('Login — vazamento de segredo na resposta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('não devolve senhaHash nem refreshTokenHash no corpo', async () => {
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue(REGISTRO_COMPLETO as any)

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: REGISTRO_COMPLETO.email, senha: 'senha-qualquer' })

    expect(res.status).toBe(200)

    // Nenhum segredo em lugar nenhum da resposta
    expect(res.body.user).not.toHaveProperty('senhaHash')
    expect(res.body.user).not.toHaveProperty('refreshTokenHash')
    expect(JSON.stringify(res.body)).not.toContain(SENHA_HASH)
    expect(JSON.stringify(res.body)).not.toContain('sha256-de-outro-token')
  })

  it('mantém os campos que o portal usa (id, email, nome, nível, filial, primeiroLogin)', async () => {
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue(REGISTRO_COMPLETO as any)

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: REGISTRO_COMPLETO.email, senha: 'senha-qualquer' })

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({
      id: REGISTRO_COMPLETO.id,
      email: REGISTRO_COMPLETO.email,
      nome: REGISTRO_COMPLETO.nome,
      nivel: 'ADMIN',
      filial: REGISTRO_COMPLETO.filial,
      primeiroLogin: true,
    })
    // Contexto de grupo que o shell do portal usa (aaccessível sem senha)
    expect(res.body.user).toHaveProperty('grupo')
    expect(res.body.user).toHaveProperty('papelUnidade')
    // Tokens continuam sendo entregues
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.refreshToken).toBeTruthy()
  })

  it('o hash da senha também não entra no accessToken', async () => {
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue(REGISTRO_COMPLETO as any)

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: REGISTRO_COMPLETO.email, senha: 'senha-qualquer' })

    expect(res.status).toBe(200)
    const payload = JSON.parse(Buffer.from(String(res.body.accessToken).split('.')[1], 'base64').toString('utf8'))
    expect(JSON.stringify(payload)).not.toContain(SENHA_HASH)
    expect(Object.keys(payload).sort()).toEqual(['email', 'exp', 'filial', 'iat', 'nivel', 'nome', 'sub', 'type'])
  })
})
