/**
 * Restrição de rota: um usuário pode ser de nível TECNICO e mesmo assim só
 * alcançar parte do sistema.
 *
 * O que estes testes existem para provar é que a trava é do SERVIDOR. Item de
 * menu escondido no portal é conveniência; se o 403 não estivesse aqui,
 * chamar /api/equipamentos direto passaria.
 *
 * O contraste com `escopoTipos` importa: aquele diz quais CHAMADOS o técnico
 * enxerga, este diz quais TELAS ele abre. São independentes, e um técnico
 * restrito normalmente tem os dois.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { pino } from 'pino'
import { errorHandler } from '../middleware/errorHandler'
import {
  podeAcessarRota,
  dominioDaRota,
  rotaLivre,
  temRestricaoDeRota,
  rotaConhecida,
  exigirRotaPermitida
} from '../services/rotas'

const TECNICO_NORMAL = {
  id: 'u1',
  nivel: 'TECNICO',
  escopoTipos: [] as string[],
  rotasPermitidas: [] as string[]
}

/** Técnico que só pode ver /chamados. */
const TECNICO_RESTRITO = { ...TECNICO_NORMAL, rotasPermitidas: ['chamados'] }

const usuario = { ...TECNICO_RESTRITO }

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api', (req, _res, next) => {
    ;(req as any).userRecord = { ...usuario }
    next()
  })
  app.use('/api', exigirRotaPermitida)
  // Rotas de mentira: o middleware decide antes de qualquer handler, então o
  // conteúdo delas é irrelevante para o teste.
  app.get('/api/chamados', (_req, res) => res.json({ ok: true }))
  app.get('/api/equipamentos', (_req, res) => res.json({ ok: true }))
  app.get('/api/dashboard/filtrado', (_req, res) => res.json({ ok: true }))
  app.get('/api/usuarios', (_req, res) => res.json({ ok: true }))
  app.get('/api/auth/trocar-senha', (_req, res) => res.json({ ok: true }))
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Restrição de rota do usuário', () => {
  let app: express.Express

  beforeEach(() => {
    Object.assign(usuario, TECNICO_RESTRITO)
    app = createApp()
  })

  describe('mapeamento de rota', () => {
    it('reconhece o domínio pelo prefixo da API', () => {
      expect(dominioDaRota('/api/chamados')).toBe('chamados')
      expect(dominioDaRota('/api/chamados/protocolo/CH-1')).toBe('chamados')
      expect(dominioDaRota('/api/equipamentos')).toBe('equipamentos')
      expect(dominioDaRota('/api/dashboard/filtrado')).toBe('dashboard')
      expect(dominioDaRota('/api/nada-desse')).toBeNull()
    })

    it('não confunde prefixo com nome parecido', () => {
      // /api/chamadosXYZ não é /api/chamados: sem exigir a barra depois do
      // prefixo, o startsWith pegaria o domínio errado e liberaria a rota errada.
      expect(dominioDaRota('/api/chamadosXYZ')).toBeNull()
    })

    it('trata /api/auth como rota de sessão, nunca bloqueada', () => {
      expect(rotaLivre('/api/auth')).toBe(true)
      expect(rotaLivre('/api/auth/trocar-senha')).toBe(true)
      expect(rotaLivre('/api/chamados')).toBe(false)
    })

    it('conhece os domínios que o CRUD aceita gravar', () => {
      expect(rotaConhecida('chamados')).toBe(true)
      expect(rotaConhecida('equipamentos')).toBe(true)
      expect(rotaConhecida('banana')).toBe(false)
    })
  })

  describe('sem restrição — o caso de todo mundo hoje', () => {
    it('lista vazia = acesso normal', () => {
      expect(temRestricaoDeRota(TECNICO_NORMAL)).toBe(false)
    })

    it('não barra nada, nem /usuarios nem /equipamentos', () => {
      expect(podeAcessarRota(TECNICO_NORMAL, '/api/equipamentos')).toBe(true)
      expect(podeAcessarRota(TECNICO_NORMAL, '/api/usuarios')).toBe(true)
      expect(podeAcessarRota(TECNICO_NORMAL, '/api/dashboard/filtrado')).toBe(true)
    })

    it('o técnico sem restrição passa em tudo pelo app de verdade', async () => {
      Object.assign(usuario, TECNICO_NORMAL)
      for (const rota of ['/api/chamados', '/api/equipamentos', '/api/usuarios']) {
        const res = await request(app).get(rota)
        expect(res.status, `rota ${rota}`).toBe(200)
      }
    })
  })

  describe('com restrição — o técnico que só vê /chamados', () => {
    it('libera a rota listada e as subrotas dela', () => {
      expect(temRestricaoDeRota(TECNICO_RESTRITO)).toBe(true)
      expect(podeAcessarRota(TECNICO_RESTRITO, '/api/chamados')).toBe(true)
      expect(podeAcessarRota(TECNICO_RESTRITO, '/api/chamados/protocolo/CH-1')).toBe(true)
    })

    it('fecha tudo fora da lista', () => {
      expect(podeAcessarRota(TECNICO_RESTRITO, '/api/equipamentos')).toBe(false)
      expect(podeAcessarRota(TECNICO_RESTRITO, '/api/usuarios')).toBe(false)
      expect(podeAcessarRota(TECNICO_RESTRITO, '/api/dashboard/filtrado')).toBe(false)
    })

    it('não deixa passar chamando a API direto, e não só escondendo o menu', async () => {
      const liberado = await request(app).get('/api/chamados')
      expect(liberado.status).toBe(200)

      for (const rota of ['/api/equipamentos', '/api/usuarios', '/api/dashboard/filtrado']) {
        const res = await request(app).get(rota)
        expect(res.status, `rota ${rota} deveria estar bloqueada`).toBe(403)
        expect(res.body.error).toBe('FORBIDDEN')
      }
    })

    it('nunca prende o usuário fora da sessão', async () => {
      // Travar /api/auth deixaria o técnico sem conseguir trocar a senha nem
      // sair — e trocar a senha é justamente o primeiro acesso dele.
      const res = await request(app).get('/api/auth/trocar-senha')
      expect(res.status).toBe(200)
    })

    it('rota fora do catálogo fica fechada por padrão, não aberta', () => {
      // Falhar fechado é o que impede um endpoint novo de vazar para o usuário
      // restrito só porque alguém esqueceu de mapear no catálogo.
      expect(podeAcessarRota(TECNICO_RESTRITO, '/api/endpoint-novo')).toBe(false)
    })

    it('restrição de rota e escopo de tipo são independentes', () => {
      const comEscopo = { ...TECNICO_RESTRITO, escopoTipos: ['sistemas::SEI', 'sistemas::PortalNet'] }
      // As duas restrições convivem sem uma anular a outra.
      expect(podeAcessarRota(comEscopo, '/api/chamados')).toBe(true)
      expect(podeAcessarRota(comEscopo, '/api/equipamentos')).toBe(false)
    })
  })

  describe('dados vindos do banco', () => {
    it('usuário sem a coluna definida (registro antigo) não fica sem rota nenhuma', () => {
      // Migration com DEFAULT '{}' cobre o banco novo, mas um registro lido
      // antes de ter a coluna pode vir com undefined. Tratar isso como "sem
      // restrição" é o que impede um ADMIN válido de cair em 403.
      const legado = { ...TECNICO_NORMAL, rotasPermitidas: undefined as unknown as string[] }
      expect(temRestricaoDeRota(legado)).toBe(false)
      expect(podeAcessarRota(legado, '/api/usuarios')).toBe(true)
    })
  })
})