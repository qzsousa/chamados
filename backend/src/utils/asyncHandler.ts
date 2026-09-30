/**
 * Rejeição de handler `async` não vira resposta no Express 4.
 *
 * O Express 4 chama o handler e ignora o que ele devolve. Num handler `async`,
 * um `throw` vira Promise rejeitada — e ninguém a observa: a requisição fica
 * pendurada sem resposta, o cliente estoura o timeout e o processo ainda leva
 * um unhandled rejection. Foi assim que uma validação inválida levou 25 s para
 * "responder" nada em vez de um 400 imediato.
 *
 * Este módulo embrulha o handler de cada camada para que a rejeição siga para
 * o `next(err)` — ou seja, para o `errorHandler`, que sabe responder 400
 * (validação), 409/404 (Prisma) e 500 (o resto). Importar uma vez, no
 * `index.ts`, antes de qualquer rota.
 *
 * Dois detalhes do Express 4.22 que custam caro e não são óbvios:
 *
 * 1. `Layer.prototype.handle` NÃO existe mais. O `handle` virou propriedade da
 *    instância (é o handler do usuário) e o despacho está em
 *    `handle_request`/`handle_error`. O pacote `express-async-errors`, que ainda
 *    embrulha `handle`, virou no-op silencioso nesta versão.
 * 2. `handle_request` chama `fn(req, res, next)` sem devolver o resultado, então
 *    não dá para inspecionar a Promise pelo retorno do despacho — é preciso
 *    olhar o `handle` da própria camada.
 *
 * A classe é descoberta pela instância do Router em vez do caminho
 * `express/lib/router/layer`: esse caminho é interno e o vitest não o resolve
 * (o módulo volta vazio). Registrar uma rota qualquer e ler `router.stack[0]`
 * dá a mesma classe em qualquer ambiente.
 *
 * Ao migrar para o Express 5 isto deixa de ser necessário (o 5 já encaminha a
 * rejeição) e pode ser removido.
 */
import express, { type NextFunction, type Request, type Response } from 'express'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (this: any, ...args: any[]) => unknown

interface CamadaExpress {
  handle?: Handler
  prototype: { handle_request?: Handler; handle_error?: Handler }
}

function resolverCamada(): CamadaExpress['prototype'] & { handle?: Handler } {
  const router = express.Router()
  router.get('/__asyncHandler__', (_req: Request, res: Response) => {
    res.end()
  })
  const camada = (router as unknown as { stack: CamadaExpress[] }).stack?.[0]
  const Layer = (camada as unknown as { constructor: CamadaExpress } | undefined)?.constructor
  if (!Layer?.prototype) {
    throw new Error('asyncHandler: não achou a Layer do Express — a proteção contra requisição pendurada não foi aplicada')
  }
  return Layer.prototype
}

/** Um embrulho por handler: o memo garante que não crescenta a cada requisição. */
const embrulhados = new WeakMap<Handler, Handler>()

function encaminharRejeicao(resultado: unknown, next: unknown) {
  if (resultado && typeof (resultado as Promise<unknown>).then === 'function' && typeof next === 'function') {
    ;(resultado as Promise<unknown>).then(undefined, (err: unknown) => (next as NextFunction)(err))
  }
}

/**
 * O embrulho PRECISA declarar a mesma quantidade de parâmetros do original: o
 * Express decide se a camada é error handler olhando `fn.length === 4`. Com
 * `...args` o embrulho ficaria com length 0, o Express deixaria de chamar o
 * errorHandler e o erro iria para o finalizador (página HTML de 500).
 */
function embrulhar(handler: Handler): Handler {
  const jaPronto = embrulhados.get(handler)
  if (jaPronto) return jaPronto

  let protegido: Handler
  if (handler.length >= 4) {
    protegido = function (this: unknown, err: unknown, req: unknown, res: unknown, next: NextFunction) {
      const resultado = handler.apply(this, [err, req, res, next])
      encaminharRejeicao(resultado, next)
      return resultado
    }
  } else {
    protegido = function (this: unknown, req: unknown, res: unknown, next: NextFunction) {
      const resultado = handler.apply(this, [req, res, next])
      encaminharRejeicao(resultado, next)
      return resultado
    }
  }

  embrulhados.set(handler, protegido)
  return protegido
}

/** Substitui `camada.handle` pelo embrulho, uma vez por camada. */
function protegerCamada(camada: CamadaExpress) {
  const handler = camada.handle
  if (typeof handler !== 'function') return
  const protegido = embrulhar(handler)
  if (protegido !== handler) camada.handle = protegido
}

const Layer = resolverCamada()
const despachoNormal = Layer.handle_request
const despachoDeErro = Layer.handle_error

if (typeof despachoNormal !== 'function') {
  throw new Error('asyncHandler: o Express mudou o despacho da Layer — a proteção contra requisição pendurada não foi aplicada')
}

Layer.handle_request = function handle_request(this: CamadaExpress, req: Request, res: Response, next: NextFunction) {
  protegerCamada(this)
  return despachoNormal.call(this, req, res, next)
}

if (typeof despachoDeErro === 'function') {
  Layer.handle_error = function handle_error(this: CamadaExpress, err: unknown, req: Request, res: Response, next: NextFunction) {
    protegerCamada(this)
    return despachoDeErro.call(this, err, req, res, next)
  }
}
