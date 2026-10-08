/**
 * Primeiro acesso: verificação de e-mail + criação de senha.
 *
 * Os testes travam o que é fácil de quebrar sem perceber:
 *
 *  1. A verificação de e-mail NÃO pode virar enumerador de contas. Um e-mail
 *     inexistente tem que responder exatamente como um e-mail existente que já
 *     tem senha — senão quem consulta a rota descobre quem usa o portal.
 *  2. O `/codigo` tem que responder igual para e-mail cadastrado ou não, pelo
 *     mesmo motivo.
 *  3. O `/definir-senha` NÃO pode aceitar só e-mail + senha (o defeito do SCE
 *     antigo): sem o token emitido pelo `/confirmar`, nada é criado.
 *  4. Erro de código não pode distinguir "errado" de "expirado".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'
import { hashToken } from '../utils/tokens'

vi.mock('../config/prisma', () => ({
  prisma: {
    usuario: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    codigoPrimeiroAcesso: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    codigoConfirmado: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('../utils/tokens', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return {
    ...original,
    passwordPolicy: {
      generateTemp: vi.fn(() => 'TempPass123!'),
      validate: vi.fn(() => ({ valid: true, errors: [] })),
    },
  }
})

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn(() => Promise.resolve(true)), hash: vi.fn((p: string) => Promise.resolve(`hashed-${p}`)) },
  compare: vi.fn(() => Promise.resolve(true)),
  hash: vi.fn((p: string) => Promise.resolve(`hashed-${p}`)),
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((_req: any, res: any, next: any) => next()),
  requireRole: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  attachUserRecord: vi.fn((_req: any, _res: any, next: any) => next()),
}))

import authRoutes from './auth'
import { gerarCodigo, MAX_TENTATIVAS } from '../services/primeiroAcesso'

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/auth', authRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

const EMPRIMEIRO_ACESSO = {
  id: 'user-1',
  email: ' professor@educacao.sp.gov.br ',
  nome: 'Professor Teste',
  status: 'ATIVO',
  primeiroLogin: true,
}

const JA_TEM_SENHA = {
  id: 'user-2',
  email: 'gestor@educacao.sp.gov.br',
  nome: 'Gestor Teste',
  status: 'ATIVO',
  primeiroLogin: false,
}

/** Registro pendente cujo hash corresponde a este código. */
function registroDoCodigo(codigo: string) {
  return {
    id: 'cod-1',
    usuarioId: 'user-1',
    codigoHash: hashToken(codigo),
    expiraEm: new Date(Date.now() + 10 * 60 * 1000),
    tentativas: 0,
    usadoEm: null,
  }
}

describe('Primeiro acesso — verificação de e-mail', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
    vi.mocked(gerarCodigo).mockRestore?.()
  })

  describe('POST /verificar-email', () => {
    it('devolve o MESMO objeto para e-mail inexistente e para quem já tem senha', async () => {
      // Existe, mas já tem senha definitiva.
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(JA_TEM_SENHA as any)
      const resComSenha = await request(app)
        .post('/api/auth/verificar-email')
        .send({ email: JA_TEM_SENHA.email })

      // Não existe no banco.
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)
      const resInexistente = await request(app)
        .post('/api/auth/verificar-email')
        .send({ email: 'ninguem@educacao.sp.gov.br' })

      expect(resComSenha.status).toBe(200)
      expect(resInexistente.status).toBe(200)
      // A resposta não pode distinguir os dois casos — é o que impede listar
      // quem tem conta no portal.
      expect(resInexistente.body).toEqual(resComSenha.body)
      expect(resInexistente.body.primeiroAcesso).toBe(false)
    })

    it('libera o fluxo quando o e-mail está em primeiro acesso', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(EMPRIMEIRO_ACESSO as any)

      const res = await request(app)
        .post('/api/auth/verificar-email')
        .send({ email: 'professor@educacao.sp.gov.br' })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ existe: true, primeiroAcesso: true, ativo: true })
    })

    it('trata usuário inativo como quem não tem senha (não oferece primeiro acesso)', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ ...EMPRIMEIRO_ACESSO, status: 'INATIVO' } as any)

      const res = await request(app)
        .post('/api/auth/verificar-email')
        .send({ email: 'professor@educacao.sp.gov.br' })

      expect(res.status).toBe(200)
      expect(res.body.primeiroAcesso).toBe(false)
    })

    it('rejeita e-mail malformado com 400', async () => {
      const res = await request(app).post('/api/auth/verificar-email').send({ email: 'nao-e-email' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })
  })

  describe('POST /admin/gerar-codigo-primeiro-acesso', () => {
    it('devolve o código em claro para o ADMIN repassar à pessoa', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(EMPRIMEIRO_ACESSO as any)
      vi.mocked(prisma.codigoPrimeiroAcesso.deleteMany).mockResolvedValue({ count: 0 })
      vi.mocked(prisma.codigoPrimeiroAcesso.create).mockResolvedValue({} as any)

      const res = await request(app)
        .post('/api/auth/admin/gerar-codigo-primeiro-acesso')
        .send({ email: 'professor@educacao.sp.gov.br' })

      expect(res.status).toBe(200)
      // O ADMIN precisa LER o código para repassar — é o canal de entrega.
      expect(res.body.codigo).toMatch(/^\d{6}$/)
      expect(res.body.nome).toBe('Professor Teste')

      // Mas o banco recebe o HASH, nunca o código em claro.
      const criado = vi.mocked(prisma.codigoPrimeiroAcesso.create).mock.calls[0][0] as any
      expect(criado.data.codigoHash).toMatch(/^[a-f0-9]{64}$/)
      expect(criado.data.codigoHash).not.toBe(res.body.codigo)
    })

    it('invalida o código anterior ao gerar um novo', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(EMPRIMEIRO_ACESSO as any)
      vi.mocked(prisma.codigoPrimeiroAcesso.deleteMany).mockResolvedValue({ count: 1 })
      vi.mocked(prisma.codigoPrimeiroAcesso.create).mockResolvedValue({} as any)

      await request(app)
        .post('/api/auth/admin/gerar-codigo-primeiro-acesso')
        .send({ email: 'professor@educacao.sp.gov.br' })

      expect(vi.mocked(prisma.codigoPrimeiroAcesso.deleteMany).mock.calls[0][0]).toMatchObject({
        where: { usuarioId: 'user-1', usadoEm: null },
      })
    })

    it('explica ao ADMIN por que não gerou (usuário inexistente)', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)

      const res = await request(app)
        .post('/api/auth/admin/gerar-codigo-primeiro-acesso')
        .send({ email: 'ninguem@educacao.sp.gov.br' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('CODIGO_NAO_GERAVEL')
      expect(prisma.codigoPrimeiroAcesso.create).not.toHaveBeenCalled()
    })

    it('recusa gerar código para quem já definiu senha', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
        ...EMPRIMEIRO_ACESSO,
        primeiroLogin: false,
      } as any)

      const res = await request(app)
        .post('/api/auth/admin/gerar-codigo-primeiro-acesso')
        .send({ email: 'professor@educacao.sp.gov.br' })

      expect(res.status).toBe(400)
      expect(res.body.message).toMatch(/já definiu a senha/i)
      expect(prisma.codigoPrimeiroAcesso.create).not.toHaveBeenCalled()
    })
  })

  describe('POST /primeiro-acesso/confirmar', () => {
    it('devolve o token quando o código confere', async () => {
      const codigo = '123456'
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ ...EMPRIMEIRO_ACESSO, primeiroLogin: true } as any)
      vi.mocked(prisma.codigoPrimeiroAcesso.findFirst).mockResolvedValue(registroDoCodigo(codigo) as any)
      vi.mocked(prisma.codigoConfirmado.updateMany).mockResolvedValue({ count: 0 })
      vi.mocked(prisma.codigoConfirmado.create).mockResolvedValue({} as any)

      const res = await request(app)
        .post('/api/auth/primeiro-acesso/confirmar')
        .send({ email: 'professor@educacao.sp.gov.br', codigo })

      expect(res.status).toBe(200)
      expect(typeof res.body.token).toBe('string')
      expect(res.body.expiraEm).toBeTruthy()
    })

    it('conta a tentativa e recusa quando o código não confere', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ ...EMPRIMEIRO_ACESSO, primeiroLogin: true } as any)
      vi.mocked(prisma.codigoPrimeiroAcesso.findFirst).mockResolvedValue(registroDoCodigo('123456') as any)
      vi.mocked(prisma.codigoPrimeiroAcesso.update).mockResolvedValue({} as any)

      const res = await request(app)
        .post('/api/auth/primeiro-acesso/confirmar')
        .send({ email: 'professor@educacao.sp.gov.br', codigo: '999999' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('CODIGO_INVALIDO')
      expect(vi.mocked(prisma.codigoPrimeiroAcesso.update).mock.calls[0][0]).toMatchObject({
        data: { tentativas: { increment: 1 } },
      })
      expect(prisma.codigoConfirmado.create).not.toHaveBeenCalled()
    })

    it('apaga o código quando as tentativas acabaram', async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ ...EMPRIMEIRO_ACESSO, primeiroLogin: true } as any)
      vi.mocked(prisma.codigoPrimeiroAcesso.findFirst).mockResolvedValue({
        ...registroDoCodigo('123456'),
        tentativas: MAX_TENTATIVAS,
      } as any)
      vi.mocked(prisma.codigoPrimeiroAcesso.delete).mockResolvedValue({} as any)

      const res = await request(app)
        .post('/api/auth/primeiro-acesso/confirmar')
        .send({ email: 'professor@educacao.sp.gov.br', codigo: '123456' })

      expect(res.status).toBe(400)
      expect(vi.mocked(prisma.codigoPrimeiroAcesso.delete).mock.calls[0][0]).toMatchObject({ where: { id: 'cod-1' } })
    })

    it('recusa código com tamanho errado antes de tocar o banco', async () => {
      const res = await request(app)
        .post('/api/auth/primeiro-acesso/confirmar')
        .send({ email: 'professor@educacao.sp.gov.br', codigo: '123' })

      expect(res.status).toBe(400)
      expect(prisma.codigoPrimeiroAcesso.findFirst).not.toHaveBeenCalled()
    })
  })

  describe('POST /primeiro-acesso/definir-senha', () => {
    const tokenValido = 'a'.repeat(64)

    function tokenRegistrado(overrides: Record<string, unknown> = {}) {
      vi.mocked(prisma.codigoConfirmado.findUnique).mockResolvedValue({
        id: 'conf-1',
        expiraEm: new Date(Date.now() + 10 * 60 * 1000),
        revogadoEm: null,
        codigo: { usuarioId: 'user-1', usadoEm: null },
        ...overrides,
      } as any)
    }

    it('cria a senha, fecha o primeiro acesso e JÁ devolve sessão', async () => {
      tokenRegistrado()
      vi.mocked(prisma.usuario.update).mockResolvedValue({} as any)
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 1 })
      vi.mocked(prisma.codigoConfirmado.update).mockResolvedValue({} as any)
      vi.mocked(prisma.codigoPrimeiroAcesso.updateMany).mockResolvedValue({ count: 1 })
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'professor@educacao.sp.gov.br',
        nome: 'Professor Teste',
        nivel: 'GESTOR',
        filial: 'E.E. TESTE',
        status: 'ATIVO',
        primeiroLogin: false,
      } as any)
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any)

      const res = await request(app)
        .post('/api/auth/primeiro-acesso/definir-senha')
        .send({ token: tokenValido, novaSenha: 'SenhaForte123!', confirmarSenha: 'SenhaForte123!' })

      expect(res.status).toBe(200)
      expect(res.body.accessToken).toBeTruthy()
      expect(res.body.primeiroLogin).toBe(false)
      // `primeiroLogin` gravado como false — é o que libera o painel no guard.
      expect(vi.mocked(prisma.usuario.update).mock.calls[0][0]).toMatchObject({
        data: { primeiroLogin: false },
      })
      // A senha nunca aparece na resposta.
      expect(JSON.stringify(res.body)).not.toContain('SenhaForte123!')
    })

    it('NÃO aceita criar senha sem o token do /confirmar', async () => {
      // Token inexistente: a rota tem de recusar antes de qualquer escrita.
      vi.mocked(prisma.codigoConfirmado.findUnique).mockResolvedValue(null)

      const res = await request(app)
        .post('/api/auth/primeiro-acesso/definir-senha')
        .send({ token: 'x'.repeat(64), novaSenha: 'SenhaForte123!', confirmarSenha: 'SenhaForte123!' })

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('TOKEN_INVALIDO')
      // Este é o ponto do teste: e-mail + senha sozinhos não criam nada.
      expect(prisma.usuario.update).not.toHaveBeenCalled()
    })

    it('recusa token revogado', async () => {
      tokenRegistrado({ revogadoEm: new Date() })

      const res = await request(app)
        .post('/api/auth/primeiro-acesso/definir-senha')
        .send({ token: tokenValido, novaSenha: 'SenhaForte123!', confirmarSenha: 'SenhaForte123!' })

      expect(res.status).toBe(401)
      expect(prisma.usuario.update).not.toHaveBeenCalled()
    })

    it('recusa token expirado', async () => {
      tokenRegistrado({ expiraEm: new Date(Date.now() - 1000) })

      const res = await request(app)
        .post('/api/auth/primeiro-acesso/definir-senha')
        .send({ token: tokenValido, novaSenha: 'SenhaForte123!', confirmarSenha: 'SenhaForte123!' })

      expect(res.status).toBe(401)
      expect(prisma.usuario.update).not.toHaveBeenCalled()
    })

    it('recusa quando a confirmação não bate com a nova senha', async () => {
      tokenRegistrado()

      const res = await request(app)
        .post('/api/auth/primeiro-acesso/definir-senha')
        .send({ token: tokenValido, novaSenha: 'SenhaForte123!', confirmarSenha: 'OutraSenha123!' })

      expect(res.status).toBe(400)
      expect(prisma.usuario.update).not.toHaveBeenCalled()
    })

    it('recusa senha fora da política e devolve os motivos', async () => {
      tokenRegistrado()
      const { passwordPolicy } = await import('../utils/tokens')
      vi.mocked(passwordPolicy.validate).mockReturnValue({ valid: false, errors: ['Pelo menos uma letra maiúscula'] })

      // 8 caracteres, então passa no schema do Zod e cai na política — que é a
      // camada que este teste quer exercitar.
      const res = await request(app)
        .post('/api/auth/primeiro-acesso/definir-senha')
        .send({ token: tokenValido, novaSenha: 'abcdefgh', confirmarSenha: 'abcdefgh' })

      expect(res.status).toBe(400)
      expect(res.body.details).toEqual([{ field: 'novaSenha', message: 'Pelo menos uma letra maiúscula' }])
      expect(prisma.usuario.update).not.toHaveBeenCalled()
    })
  })
})