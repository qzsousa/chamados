import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../config/prisma'
import { signAccessToken, signRefreshToken, hashToken, verifyRefreshToken } from '../utils/jwt'
import { passwordPolicy } from '../utils/tokens'
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth'
import { LoginRequestSchema, ChangePasswordSchema, GerarSenhaTemporariaSchema, LoginResponseSchema } from '@shared/api'
import { ZodError } from 'zod'

const router = Router()

const BCRYPT_COST = 12
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, REFRESH_COOKIE_OPTIONS)
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie('refreshToken', { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 })
}

function buildLoginResponse(user: { id: string; email: string; nome: string; nivel: string; filial: string; primeiroLogin: boolean }) {
  const accessToken = signAccessToken(user as any)
  const refreshToken = signRefreshToken(user.id)
  const refreshTokenHash = hashToken(refreshToken)

  return { accessToken, refreshToken, refreshTokenHash, user }
}

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = LoginRequestSchema.parse(req.body)

    const user = await prisma.usuario.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (!user || user.status !== 'ATIVO') {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Credenciais inválidas' })
    }

    const valid = await bcrypt.compare(senha, user.senhaHash)
    if (!valid) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Credenciais inválidas' })
    }

    const { accessToken, refreshToken, refreshTokenHash, user: userResponse } = buildLoginResponse(user)

    await prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        usuarioId: user.id,
        expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    })

    setRefreshCookie(res, refreshToken)

    return res.json({
      accessToken,
      refreshToken,
      user: userResponse,
      primeiroLogin: user.primeiroLogin
    })
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken

    if (!refreshToken) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Refresh token não fornecido' })
    }

    const payload = verifyRefreshToken(refreshToken)
    if (!payload || payload.type !== 'refresh') {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Refresh token inválido' })
    }

    // O tokenHash é gravado com SHA-256 (hashToken) no login; a validação
    // precisa usar o mesmo hash — bcrypt.compare nunca bateria com SHA-256.
    const storedToken = await prisma.refreshToken.findFirst({
      where: { usuarioId: payload.sub, tokenHash: hashToken(refreshToken) }
    })

    if (!storedToken) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Sessão inválida' })
    }

    if (storedToken.expiraEm < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } })
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Refresh token expirado ou inválido' })
    }

    await prisma.refreshToken.delete({ where: { id: storedToken.id } })

    const user = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, nome: true, nivel: true, filial: true, primeiroLogin: true, status: true }
    })

    if (!user || user.status !== 'ATIVO') {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Usuário não encontrado ou inativo' })
    }

    const { accessToken, refreshToken: newRefreshToken, refreshTokenHash, user: userResponse } = buildLoginResponse(user)

    await prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        usuarioId: user.id,
        expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    })

    setRefreshCookie(res, newRefreshToken)

    return res.json({
      accessToken,
      refreshToken: newRefreshToken,
      user: userResponse,
      primeiroLogin: user.primeiroLogin
    })
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user) {
      const refreshToken = req.cookies?.refreshToken
      if (refreshToken) {
        const tokenHash = hashToken(refreshToken)
        await prisma.refreshToken.deleteMany({
          where: { tokenHash, usuarioId: req.user.sub }
        })
      }
    }
    clearRefreshCookie(res)
    return res.json({ success: true })
  } catch (err) {
    clearRefreshCookie(res)
    throw err
  }
})

router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Não autenticado' })
    }

    const user = await prisma.usuario.findUnique({
      where: { id: req.user.sub },
      select: { id: true, email: true, nome: true, nivel: true, filial: true, status: true, primeiroLogin: true, createdAt: true, updatedAt: true }
    })

    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Usuário não encontrado' })
    }

    return res.json(user)
  } catch (err) {
    throw err
  }
})

router.post('/change-password', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { senhaAtual, novaSenha } = ChangePasswordSchema.parse(req.body)

    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Não autenticado' })
    }

    const user = await prisma.usuario.findUnique({ where: { id: req.user.sub } })
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Usuário não encontrado' })
    }

    if (!user.primeiroLogin) {
      const valid = await bcrypt.compare(senhaAtual, user.senhaHash)
      if (!valid) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Senha atual incorreta' })
      }
    }

    const policy = passwordPolicy.validate(novaSenha)
    if (!policy.valid) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nova senha não atende aos requisitos', details: policy.errors.map(e => ({ field: 'novaSenha', message: e })) })
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, BCRYPT_COST)

    await prisma.usuario.update({
      where: { id: user.id },
      data: {
        senhaHash: novaSenhaHash,
        primeiroLogin: false
      }
    })

    await prisma.refreshToken.deleteMany({ where: { usuarioId: user.id } })
    clearRefreshCookie(res)

    return res.json({ success: true, message: 'Senha alterada com sucesso. Faça login novamente.' })
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.post('/admin/gerar-senha-temporaria', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { email } = GerarSenhaTemporariaSchema.parse(req.body)

    const user = await prisma.usuario.findUnique({ where: { email: email.toLowerCase() } })
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Usuário não encontrado' })
    }

    const senhaTemporaria = passwordPolicy.generateTemp()
    const senhaHash = await bcrypt.hash(senhaTemporaria, BCRYPT_COST)

    await prisma.usuario.update({
      where: { id: user.id },
      data: {
        senhaHash,
        primeiroLogin: true
      }
    })

    await prisma.refreshToken.deleteMany({ where: { usuarioId: user.id } })

    return res.json({ senhaTemporaria })
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

export default router