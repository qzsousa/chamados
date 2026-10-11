import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { isZodError } from '../utils/zodError'
import { Prisma } from '@prisma/client'
import pino from 'pino'
import { notificarAdmins } from '../services/notificacoes'

export function errorHandler(logger: pino.Logger) {
  return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string || 'unknown'

    /* ---- corpo grande demais (413) ----
       O body-parser (express.json) lança `entity.too.large` com status 413,
       que é o que o portal já espera em NovoChamadoView.vue. Sem este branch o
       erro caía no "500 genérico" E disparava notificarAdmins — ou seja, uma
       escola mandando arquivo grande acordava a administração com alerta de
       erro do sistema. Payload grande é erro do cliente, não incidente. */
    if (ehPayloadGrandeDemais(err)) {
      logger.warn({ requestId, method: req.method, url: req.originalUrl }, 'Payload too large')
      res.status(413).json({
        error: 'PAYLOAD_TOO_LARGE',
        message: 'Arquivo ou corpo da requisição maior que o limite permitido'
      })
      return
    }

    if (isZodError(err)) {
      logger.warn({ requestId, errors: err.flatten().fieldErrors }, 'Validation error')
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: Object.entries(err.flatten().fieldErrors).map(([field, messages]) => ({
          field,
          message: messages?.join(', ') || 'Valor inválido'
        }))
      })
      return
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        const target = (err.meta?.target as string[])?.join(', ') || 'campo'
        logger.warn({ requestId, target }, 'Unique constraint violation')
        res.status(409).json({
          error: 'VALIDATION_ERROR',
          message: `${target} já existe`
        })
        return
      }
      if (err.code === 'P2025') {
        logger.warn({ requestId }, 'Record not found')
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Registro não encontrado'
        })
        return
      }
    }

    logger.error({ requestId, err: err.message, stack: err.stack }, 'Internal error')

    // Notifica a administração — nunca deixe isso derrubar a resposta de erro
    notificarAdmins(
      'ERRO_SISTEMA',
      'Erro interno na API de chamados',
      `${req.method} ${req.originalUrl} — ${err.message}`.slice(0, 400),
      '/painel'
    ).catch(() => {})

    if (env.NODE_ENV === 'production') {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor'
      })
    } else {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: err.message,
        stack: err.stack
      })
    }
  }
}

import { env } from '../config/env'

/**
 * O body-parser marca corpo grande demais com `type: 'entity.too.large'` e
 * `status: 413`. Checamos os três jeitos porque a marca muda entre a versão do
 * body-parser e a forma como o erro chega pelo express (alguns caminhos
 * embrulham o erro e perdem `type`).
 */
function ehPayloadGrandeDemais(err: Error & { type?: string; status?: number; statusCode?: number }): boolean {
  return (
    err?.type === 'entity.too.large' ||
    err?.status === 413 ||
    err?.statusCode === 413
  )
}