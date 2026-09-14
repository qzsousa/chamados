import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import pino from 'pino'
import * as Sentry from '@sentry/node'

import { env } from './config/env'
import { prisma } from './config/prisma'
import { authMiddleware, attachUserRecord } from './middleware/auth'
import { errorHandler } from './middleware/errorHandler'
import { requestLogger } from './middleware/requestLogger'

import authRoutes from './routes/auth'
import usuarioRoutes from './routes/usuarios'
import chamadoRoutes, { criarChamadoPublic, consultarChamadoPublic } from './routes/chamados'
import escolaRoutes from './routes/escolas'
import equipamentoRoutes from './routes/equipamentos'
import inventarioRoutes from './routes/inventario'
import dashboardRoutes from './routes/dashboard'
import { LISTA_ESCOLAS_EMAILS } from './services/normalization'
import { syncInventario } from './services/migration'

const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined
})

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.1
  })
}

const app = express()

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}))

app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'RATE_LIMITED', message: 'Muitas requisições, tente novamente em um minuto' },
  standardHeaders: true,
  legacyHeaders: false
})

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'RATE_LIMITED', message: 'Muitas tentativas de login, aguarde um minuto' },
  standardHeaders: true,
  legacyHeaders: false
})

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'RATE_LIMITED', message: 'Muitas tentativas de renovação, aguarde um minuto' },
  standardHeaders: true,
  legacyHeaders: false
})

app.use(generalLimiter)
app.use(requestLogger(logger))

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      version: process.env.npm_package_version || '1.0.0'
    })
  } catch {
    res.status(503).json({
      status: 'down',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'disconnected',
      version: process.env.npm_package_version || '1.0.0'
    })
  }
})

app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/auth/refresh', refreshLimiter)

// Public endpoints para cascata do Forms (sem auth)
app.get('/api/equipamentos/categorias', async (_req, res) => {
  try {
    const categorias = await prisma.equipamento.findMany({
      select: { categoria: true },
      distinct: ['categoria'],
      orderBy: { categoria: 'asc' }
    })
    return res.json(categorias.map(c => c.categoria))
  } catch (err) { throw err }
})

app.get('/api/equipamentos/marcas', async (req, res) => {
  try {
    const { categoria } = req.query
    if (!categoria) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Parâmetro categoria obrigatório' })
    const marcas = await prisma.equipamento.findMany({
      where: { categoria: categoria as string },
      select: { marca: true },
      distinct: ['marca'],
      orderBy: { marca: 'asc' }
    })
    return res.json(marcas.map(m => m.marca))
  } catch (err) { throw err }
})

app.get('/api/equipamentos/modelos', async (req, res) => {
  try {
    const { categoria, marca } = req.query
    if (!categoria || !marca) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Parâmetros categoria e marca obrigatórios' })
    const modelos = await prisma.equipamento.findMany({
      where: { categoria: categoria as string, marca: marca as string },
      select: { modelo: true },
      distinct: ['modelo'],
      orderBy: { modelo: 'asc' }
    })
    return res.json(modelos.map(m => m.modelo))
  } catch (err) { throw err }
})

// Lista pública de escolas (para o formulário)
app.get('/api/escolas/nomes', async (_req, res) => {
  try {
    return res.json(Object.keys(LISTA_ESCOLAS_EMAILS).sort())
  } catch (err) { throw err }
})

// Criação de chamado é pública (formulário sem login)
app.post('/api/chamados', criarChamadoPublic)
// Consulta pública de chamado por protocolo
app.get('/api/chamados/protocolo/:protocolo', consultarChamadoPublic)

app.use('/api/dashboard', dashboardRoutes)
app.use('/api', authMiddleware, attachUserRecord)
app.use('/api/usuarios', usuarioRoutes)
app.use('/api/chamados', chamadoRoutes)
app.use('/api/escolas', escolaRoutes)
app.use('/api/equipamentos', equipamentoRoutes)
app.use('/api/inventario', inventarioRoutes)

if (env.SENTRY_DSN) {
  app.use(Sentry.expressErrorHandler())
}

app.use(errorHandler(logger))

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Server running on port ${env.PORT} (${env.NODE_ENV})`)
})

// Sincronização automática de inventário (escolas + status)
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000
async function autoSyncInventario() {
  try {
    await syncInventario()
  } catch (err) {
    logger.error({ err }, 'falha na sincronização automática de inventário')
  }
}
setTimeout(autoSyncInventario, 5000)
setInterval(autoSyncInventario, SYNC_INTERVAL_MS)

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully')
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully')
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
})

export { app, logger }