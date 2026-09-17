import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth'
import { UserCreateSchema, UserUpdateSchema, UserWithTempPasswordSchema, PaginatedResponseSchema, UserSchema } from '@shared/api'
import { passwordPolicy } from '../utils/tokens'
import { syncUsuarioParaSce } from '../services/sceSync'
import { ZodError } from 'zod'

const router = Router()
const BCRYPT_COST = 12

router.get('/', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const search = (req.query.search as string) || ''
    const nivel = req.query.nivel as string
    const status = req.query.status as string

    const where: any = {}
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { nome: { contains: search, mode: 'insensitive' } }
      ]
    }
    if (nivel) where.nivel = nivel
    if (status) where.status = status

    const [total, data] = await Promise.all([
      prisma.usuario.count({ where }),
      prisma.usuario.findMany({
        where,
        select: { id: true, email: true, nome: true, nivel: true, filial: true, status: true, primeiroLogin: true, createdAt: true, updatedAt: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }
      })
    ])

    return res.json({
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    })
  } catch (err) {
    throw err
  }
})

router.post('/', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const data = UserCreateSchema.parse(req.body)

    const existing = await prisma.usuario.findUnique({ where: { email: data.email.toLowerCase() } })
    if (existing) {
      return res.status(409).json({ error: 'VALIDATION_ERROR', message: 'Email já cadastrado' })
    }

    const senhaTemporaria = passwordPolicy.generateTemp()
    const senhaHash = await bcrypt.hash(senhaTemporaria, BCRYPT_COST)

    const user = await prisma.usuario.create({
      data: {
        email: data.email.toLowerCase(),
        nome: data.nome,
        nivel: data.nivel,
        filial: data.filial,
        senhaHash,
        primeiroLogin: true
      },
      select: { id: true, email: true, nome: true, nivel: true, filial: true, status: true, primeiroLogin: true, createdAt: true, updatedAt: true }
    })

    // Mantém a tabela `usuarios` do SCE sincronizada (portal usa um login só)
    syncUsuarioParaSce(user).catch(() => {})

    return res.status(201).json({ ...user, senhaTemporaria })
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.get('/:id', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.usuario.findUnique({
      where: { id: req.params.id },
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

router.patch('/:id', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const data = UserUpdateSchema.parse(req.body)

    const user = await prisma.usuario.findUnique({ where: { id: req.params.id } })
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Usuário não encontrado' })
    }

    const updated = await prisma.usuario.update({
      where: { id: req.params.id },
      data: {
        nome: data.nome,
        nivel: data.nivel,
        filial: data.filial,
        status: data.status
      },
      select: { id: true, email: true, nome: true, nivel: true, filial: true, status: true, primeiroLogin: true, createdAt: true, updatedAt: true }
    })

    if (data.status === 'INATIVO') {
      await prisma.refreshToken.deleteMany({ where: { usuarioId: updated.id } })
    }

    syncUsuarioParaSce(updated).catch(() => {})

    return res.json(updated)
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.usuario.findUnique({ where: { id: req.params.id } })
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Usuário não encontrado' })
    }

    if (user.id === req.user?.sub) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Não pode desativar a si mesmo' })
    }

    await prisma.usuario.update({
      where: { id: req.params.id },
      data: { status: 'INATIVO' }
    })

    await prisma.refreshToken.deleteMany({ where: { usuarioId: req.params.id } })

    syncUsuarioParaSce({ ...user, status: 'INATIVO' }).catch(() => {})

    return res.json({ success: true })
  } catch (err) {
    throw err
  }
})

export default router