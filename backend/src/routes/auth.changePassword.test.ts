/**
 * Troca de senha: quem pode pular a senha atual, e quem não pode.
 *
 * Este teste existe por causa de um defeito que só apareceu no teste de fluxo
 * ponta a ponta: `ChangePasswordSchema` exigia `senhaAtual` com tamanho
 * mínimo 1, e o corpo era validado ANTES do handler. Quem não tem senha antiga
 * — nunca definiu senha, ou recebeu senha provisória da Matriz — ficava
 * trancado: a tela mandava para a troca, e a troca respondia 400.
 *
 * Por isso o teste monta o app real, com o schema real, e so mocka o banco.
 * Um teste que mockasse o handler passaria com o defeito presente.
 *
 * A folga no schema (aceitar vazio) não pode virar brecha: quem tem senha
 * definitiva e manda vazio ou errada continua recebendo 401.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { pino } from 'pino'
import { errorHandler } from '../middleware/errorHandler'
import { prisma } from '../config/prisma'
import bcrypt from 'bcryptjs'

vi.mock('../config/prisma', () => ({
  prisma: {
    usuario: { findUnique: vi.fn(), update: vi.fn() },
    refreshToken: { deleteMany: vi.fn() },
  },
}))

// O middleware real: o teste precisa da checagem de role e do userRecord, e
// o schema precisa rodar de verdade.
vi.mock('../middleware/auth', async (importOriginal) => {
  const real = await importOriginal<typeof import('../middleware/auth')>()
  return { ...real, authMiddleware: (req: any, _res: any, next: any) => next() }
})

import { ChangePasswordSchema } from '@shared/api'
import changePasswordRouter from '../routes/auth'

const SENHA_ATUAL = 'SenhaAntiga@2026'
const SENHA_NOVA = 'SenhaNova@2026'

/** Usuário com senha definitiva (o caso comum). */
const COM_SENHA = {
  id: 'u1',
  email: 'maria@educacao.sp.gov.br',
  senhaHash: bcrypt.hashSync(SENHA_ATUAL, 4),
  primeiroLogin: false,
  senhaProvisoria: false,
}

/** Matriz acabou de gerar senha provisória: não há senha antiga para conferir. */
const COM_SENHA_PROVISORIA = {
  ...COM_SENHA,
  primeiroLogin: false,
  senhaProvisoria: true,
}

/** Nunca entrou no sistema: o fluxo do código de 6 dígitos. */
const PRIMEIRO_ACESSO = {
  ...COM_SENHA,
  primeiroLogin: true,
  senhaProvisoria: false,
}

const createApp = () => {
  const app = express()
  app.use(express.json())
  // `attachUserRecord` pega o usuário do corpo do teste; `authMiddleware` real
  // seria o que rejeitaria sem Bearer, e aqui não é o que se quer testar.
  app.use((req: any, _res, next) => {
    req.user = { sub: 'u1', email: 'maria@educacao.sp.gov.br' }
    req.userRecord = { id: 'u1', nivel: 'ADMIN', status: 'ATIVO' }
    next()
  })
  app.use('/api/auth', changePasswordRouter)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Troca de senha — quem pode pular a senha atual', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.usuario.update).mockResolvedValue({} as any)
    vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 0 } as any)
  })

  describe('o contrato aceita senhaAtual vazio', () => {
    it('não recusa o corpo antes do handler', () => {
      // Este é o defeito: o schema recusava vazio e a pessoa ficava trancada
      // antes de o handler ter chance de decidir.
      const r = ChangePasswordSchema.safeParse({ senhaAtual: '', novaSenha: SENHA_NOVA })
      expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true)
    })

    it('ainda exige a senha nova com tamanho mínimo', () => {
      expect(ChangePasswordSchema.safeParse({ senhaAtual: '', novaSenha: 'abc' }).success).toBe(false)
    })
  })

  describe('quem tem senha provisória (o caso que estava travado)', () => {
    beforeEach(() => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(COM_SENHA_PROVISORIA as any)
    })

    it('troca a senha mandando vazio no lugar da antiga', async () => {
      const res = await request(createApp())
        .post('/api/auth/change-password')
        .send({ senhaAtual: '', novaSenha: SENHA_NOVA })

      // Antes: 400 do schema. Era o que prendia a pessoa.
      expect(res.status).toBe(200)
      expect(prisma.usuario.update).toHaveBeenCalled()
    })

    it('limpa a marca de provisória — senão a pessoa entra e cai na troca de novo', async () => {
      await request(createApp())
        .post('/api/auth/change-password')
        .send({ senhaAtual: '', novaSenha: SENHA_NOVA })

      const dados = vi.mocked(prisma.usuario.update).mock.calls[0][0].data
      expect(dados.senhaProvisoria).toBe(false)
      expect(dados.primeiroLogin).toBe(false)
    })

    it('derruba as sessões: a senha acabou de mudar', async () => {
      await request(createApp())
        .post('/api/auth/change-password')
        .send({ senhaAtual: '', novaSenha: SENHA_NOVA })

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalled()
    })

    it('recusa uma senha nova fraca mesmo sem conferir a antiga', async () => {
      const res = await request(createApp())
        .post('/api/auth/change-password')
        .send({ senhaAtual: '', novaSenha: 'abc' })

      expect(res.status).toBe(400)
      expect(prisma.usuario.update).not.toHaveBeenCalled()
    })
  })

  describe('quem nunca definiu senha (primeiro acesso)', () => {
    beforeEach(() => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(PRIMEIRO_ACESSO as any)
    })

    it('troca a senha sem informar a antiga', async () => {
      const res = await request(createApp())
        .post('/api/auth/change-password')
        .send({ senhaAtual: '', novaSenha: SENHA_NOVA })

      expect(res.status).toBe(200)
      expect(prisma.usuario.update).toHaveBeenCalled()
    })
  })

  describe('quem tem senha definitiva — a folga do schema não abre brecha', () => {
    beforeEach(() => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue(COM_SENHA as any)
    })

    it('recusa senha atual vazia com 401, não troca', async () => {
      const res = await request(createApp())
        .post('/api/auth/change-password')
        .send({ senhaAtual: '', novaSenha: SENHA_NOVA })

      // Este é o contra-teste do defeito: aceitar vazio no schema NÃO pode
      // virar "troque a senha sem provar que é você".
      expect(res.status).toBe(401)
      expect(prisma.usuario.update).not.toHaveBeenCalled()
    })

    it('recusa senha atual incorreta com 401', async () => {
      const res = await request(createApp())
        .post('/api/auth/change-password')
        .send({ senhaAtual: 'SenhaErrada@2026', novaSenha: SENHA_NOVA })

      expect(res.status).toBe(401)
      expect(prisma.usuario.update).not.toHaveBeenCalled()
    })

    it('troca quando a senha atual confere', async () => {
      const res = await request(createApp())
        .post('/api/auth/change-password')
        .send({ senhaAtual: SENHA_ATUAL, novaSenha: SENHA_NOVA })

      expect(res.status).toBe(200)
      expect(prisma.usuario.update).toHaveBeenCalled()
    })
  })
})