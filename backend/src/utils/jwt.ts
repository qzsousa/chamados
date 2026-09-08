import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import type { User, Nivel } from '@shared/api'

export interface AccessTokenPayload {
  sub: string
  email: string
  nome: string
  nivel: Nivel
  filial: string
  iat: number
  exp: number
  type: 'access'
}

export interface RefreshTokenPayload {
  sub: string
  iat: number
  exp: number
  type: 'refresh'
}

export function signAccessToken(user: User): string {
  const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email,
    nome: user.nome,
    nivel: user.nivel,
    filial: user.filial,
    type: 'access'
  }

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn']
  })
}

export function signRefreshToken(userId: string): string {
  const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
    sub: userId,
    type: 'refresh'
  }

  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn']
  })
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload
  } catch {
    return null
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload
  } catch {
    return null
  }
}

export function decodeToken(token: string): AccessTokenPayload | RefreshTokenPayload | null {
  try {
    return jwt.decode(token) as AccessTokenPayload | RefreshTokenPayload
  } catch {
    return null
  }
}

export function getTokenExpiry(token: string): Date | null {
  const decoded = decodeToken(token)
  if (!decoded || !decoded.exp) return null
  return new Date(decoded.exp * 1000)
}

// Re-export from tokens.ts for convenience
export { hashToken } from './tokens'