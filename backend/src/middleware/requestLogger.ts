import { Request, Response, NextFunction } from 'express'
import pino from 'pino'

export function requestLogger(logger: pino.Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now()
    const requestId = req.headers['x-request-id'] as string || generateRequestId()

    res.setHeader('x-request-id', requestId)

    res.on('finish', () => {
      const duration = Date.now() - start
      const logLevel = res.statusCode >= 400 ? 'warn' : 'info'

      logger[logLevel]({
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
        ip: req.ip,
        userAgent: req.get('user-agent')
      }, 'HTTP Request')
    })

    next()
  }
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}