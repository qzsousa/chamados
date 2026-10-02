import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express, { type Request, type Response } from 'express'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { ZodError, z } from 'zod'
import { isZodError } from './zodError'
import { notificarAdmins } from '../services/notificacoes'
import { vi } from 'vitest'

vi.mock('../services/notificacoes', () => ({
  notificarAdmins: vi.fn(() => Promise.resolve())
}))

/**
 * O patch é importado pelo setup (src/test/setup.ts) — igual ao index.ts em
 * produção. Se ele deixar de aplicar, estes testes estouram o timeout de 30 s
 * em vez de falhar na hora, que é o próprio sintoma que ele corrige.
 */
describe('rejeição de handler async', () => {
  const app = () => {
    const a = express()
    a.use(express.json())
    a.get('/quebra', async () => {
      throw new Error('deu ruim no banco')
    })
    a.get('/zod', async () => {
      throw z.object({ status: z.enum(['ABERTO', 'RESOLVIDO']) }).parse({ status: 'INVALIDO' })
    })
    a.use(errorHandler(pino({ level: 'silent' })))
    return a
  }

  it('CONTROLE: o errorHandler responde sozinho', () => {
    const handler = errorHandler(pino({ level: 'silent' }))
    const res: any = { statusCode: 0, corpo: null, status(c: number) { this.statusCode = c; return this }, json(b: any) { this.corpo = b; return this } }
    handler(new Error('boom'), { headers: {} } as any, res, (() => {}) as any)
    expect(res.statusCode).toBe(500)
    expect(res.corpo.error).toBe('INTERNAL_ERROR')
  })

  it('CONTROLE: um error handler próprio é chamado no throw síncrono', async () => {
    // Se o embrulho do patch mudasse a aridade da camada, o Express pararia de
    // reconhecer error handlers e cairia no finalizador (HTML). Este teste
    // trava essa garantia.
    const a = express()
    a.get('/sync', () => {
      throw new Error('boom')
    })
    a.use(((err: any, _req: any, res: any, _next: any) => {
      res.status(500).json({ error: 'DO_MEU_HANDLER', mensagem: err.message })
    }))
    const res = await request(a).get('/sync')
    expect(res.body.error).toBe('DO_MEU_HANDLER')
  })

  it('CONTROLE: throw síncrono (o Express já encaminha) chega ao errorHandler', async () => {
    const a = express()
    a.use(express.json())
    a.get('/sync', () => {
      throw new Error('deu ruim no banco')
    })
    a.use(errorHandler(pino({ level: 'silent' })))
    const res = await request(a).get('/sync')
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('INTERNAL_ERROR')
  })

  it('erro comum em handler async vira 500 em vez de requisição pendurada', async () => {
    const res = await request(app()).get('/quebra')
    expect(res.status).toBe(500)
    expect(res.text).toContain('INTERNAL_ERROR')
  })

  it('ZodError vindo de outra cópia do zod ainda vira 400', async () => {
    // Cópia "de outro pacote": o erro NÃO é instanceof do ZodError do backend.
    const zodDeOutro = require('../../../shared/types/node_modules/zod')
    const erro = zodDeOutro.ZodError.create([
      { code: 'invalid_enum_value', received: 'INVALIDO', options: ['ABERTO'], path: ['status'], message: 'inválido' }
    ])

    const a = express()
    a.use(express.json())
    a.get('/zod', async () => {
      throw erro
    })
    a.use(errorHandler(pino({ level: 'silent' })))

    const res = await request(a).get('/zod')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('isZodError aceita as duas cópias e rejeita o resto', () => {
    const meu = new ZodError([])
    const deOutro = require('../../../shared/types/node_modules/zod')
    const zodDeOutro = new deOutro.ZodError([])

    expect(isZodError(meu)).toBe(true)
    expect(isZodError(zodDeOutro)).toBe(true)
    expect(isZodError(new Error('comum'))).toBe(false)
    expect(isZodError(null)).toBe(false)
    expect(isZodError(undefined)).toBe(false)
    expect(isZodError({ name: 'ZodError' })).toBe(true) // só o nome já basta
  })

  it('a notificação de erro interno nunca derruba a resposta', () => {
    expect(notificarAdmins).toBeDefined()
  })

  it('o embrulho NÃO cresce a cada requisição na mesma camada', async () => {
    // Regressão: `protegerCamada` trocava `camada.handle` pelo embrulho, mas o
    // memo (`embrulhados`) só guardava a chave ORIGINAL -> embrulho. No
    // despacho seguinte entrava o próprio embrulho como `handler`, o memo
    // errava, e um embrulho novo era criado em volta do anterior. Cada
    // requisição somava um nível de recursão na MESMA camada até estourar a
    // pilha ("Maximum call stack size exceeded") — e só depois de muito
    // tráfego, o que escondia a origem. O `layer.handle` tem que ser estável.
    const a = express()
    a.get('/alvo', (_req: Request, res: Response) => {
      res.json({ ok: true })
    })

    await request(a).get('/alvo')
    const camada = (a as unknown as { _router: { stack: Array<{ handle: unknown }> } })._router.stack[0]
    const primeiro = camada.handle

    for (let i = 0; i < 25; i++) {
      const res = await request(a).get('/alvo')
      expect(res.status).toBe(200)
    }

    expect(camada.handle).toBe(primeiro)
  })
})
