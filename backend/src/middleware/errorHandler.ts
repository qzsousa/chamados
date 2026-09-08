import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import pino from 'pino'

export function errorHandler(logger: pino.Logger) {
  return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string || 'unknown'

    if (err instanceof ZodError) {
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