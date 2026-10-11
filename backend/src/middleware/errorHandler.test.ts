/**
 * 413 de verdade no errorHandler.
 *
 * O body-parser (express.json) lança `entity.too.large` com status 413 quando o
 * corpo estoura o limite. O errorHandler só olhava ZodError/P2002/P2025, então
 * esse erro caía no "500 genérico" E disparava notificarAdmins — uma escola
 * mandando arquivo grande acordava a administração com alerta de erro do
 * sistema. O portal já tratava 413 (NovoChamadoView.vue), ou seja, o ramo
 * existia do lado do cliente e nunca era alcançado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { pino } from 'pino'
import { errorHandler } from './errorHandler'
import { notificarAdmins } from '../services/notificacoes'

vi.mock('../services/notificacoes', () => ({
  notificarAdmins: vi.fn(() => Promise.resolve())
}))

const LIMITE_TESTE = '1mb'

const createApp = () => {
  const app = express()
  app.use(express.json({ limit: LIMITE_TESTE }))
  app.post('/api/qualquer', (_req, res) => { res.json({ ok: true }) })
  // Mesmo erro que o body-parser levanta, sem o `type`: cobre o caminho em que
  // o erro é embrulhado e chega só com `status`.
  app.post('/api/embrulhado', () => {
    const err: any = new Error('request entity too large')
    err.status = 413
    throw err
  })
  app.post('/api/quebra', () => { throw new Error('deu ruim de verdade') })
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('errorHandler — corpo grande demais', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
  })

  it('devolve 413 (não 500) quando o corpo estoura o limite do body-parser', async () => {
    const grande = { descricao: 'x'.repeat(2 * 1024 * 1024) }
    const res = await request(app).post('/api/qualquer').send(grande)

    expect(res.status).toBe(413)
    expect(res.body.error).toBe('PAYLOAD_TOO_LARGE')
  })

  it('NÃO notifica a administração quando o payload é grande demais', async () => {
    await request(app).post('/api/qualquer').send({ descricao: 'x'.repeat(2 * 1024 * 1024) })

    expect(notificarAdmins).not.toHaveBeenCalled()
  })

  it('reconhece o 413 mesmo quando o erro chega só com status (sem type)', async () => {
    const res = await request(app).post('/api/embrulhado').send({})

    expect(res.status).toBe(413)
    expect(notificarAdmins).not.toHaveBeenCalled()
  })

  it('corpo dentro do limite continua passando direto', async () => {
    const res = await request(app).post('/api/qualquer').send({ descricao: 'x'.repeat(1000) })

    expect(res.status).toBe(200)
    expect(notificarAdmins).not.toHaveBeenCalled()
  })

  it('erro interno continua 500 e continua notificando os admins', async () => {
    const res = await request(app).post('/api/quebra').send({})

    expect(res.status).toBe(500)
    expect(notificarAdmins).toHaveBeenCalled()
  })
})