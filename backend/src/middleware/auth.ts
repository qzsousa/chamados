import { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/prisma'
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt'
import { env } from '../config/env'

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload
  userRecord?: {
    id: string
    email: string
    nome: string
    nivel: string
    filial: string
    status: string
    primeiroLogin: boolean
    /**
     * Escopo de tipos de chamado (`["sistemas::PortalNet", ...]`). Lista vazia
     * = sem restrição, e aí quem limita a visibilidade é o `filial` — é o
     * comportamento de sempre. Ver `services/escopo.ts`.
     */
    escopoTipos: string[]
  }
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token de acesso não fornecido' })
    return
  }

  const token = authHeader.slice(7)
  const payload = verifyAccessToken(token)

  if (!payload) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token inválido ou expirado' })
    return
  }

  if (payload.type !== 'access') {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Tipo de token inválido' })
    return
  }

  req.user = payload
  next()
}

export async function attachUserRecord(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    next()
    return
  }

  try {
    const user = await prisma.usuario.findUnique({
      where: { id: req.user.sub },
      select: {
        id: true,
        email: true,
        nome: true,
        nivel: true,
        filial: true,
        status: true,
        primeiroLogin: true,
        escopoTipos: true
      }
    })

    if (!user || user.status !== 'ATIVO') {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Usuário não encontrado ou inativo' })
      return
    }

    req.userRecord = user
    next()
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao buscar usuário' })
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.userRecord) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Usuário não autenticado' })
      return
    }

    if (!allowedRoles.includes(req.userRecord.nivel)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão para acessar este recurso' })
      return
    }

    next()
  }
}

export function requireFilialAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.userRecord) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Usuário não autenticado' })
    return
  }

  if (req.userRecord.nivel === 'ADMIN') {
    next()
    return
  }

  const filialParam = (req.params.filial as string) || (req.query.filial as string) || (req.body?.filial as string)

  if (filialParam && filialParam !== req.userRecord.filial) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado a esta filial' })
    return
  }

  next()
}