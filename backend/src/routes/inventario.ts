import { Router, Response } from 'express'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth'
import { InventarioSchema, InventarioUpdateSchema } from '@shared/api'
import { ZodError } from 'zod'
import { syncInventario } from '../services/migration'

const router = Router()

router.post('/sync', authMiddleware, requireRole('ADMIN'), async (_req: AuthenticatedRequest, res) => {
  try {
    const result = await syncInventario()
    if (!result.ok) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: result.motivo || 'Não foi possível sincronizar' })
    }
    return res.json({ success: true })
  } catch (err) {
    throw err
  }
})

router.get('/', authMiddleware, async (_req: AuthenticatedRequest, res) => {
  try {
    const inventarios = await prisma.inventario.findMany({
      include: { escola: true },
      orderBy: { escola: { nome: 'asc' } }
    })

    return res.json(inventarios)
  } catch (err) {
    throw err
  }
})

router.get('/:escolaId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const inventario = await prisma.inventario.findUnique({
      where: { escolaId: req.params.escolaId },
      include: { escola: true }
    })

    if (!inventario) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Inventário não encontrado para esta escola' })
    }

    return res.json(inventario)
  } catch (err) {
    throw err
  }
})

router.patch('/:escolaId', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const data = InventarioUpdateSchema.parse(req.body)

    const inventario = await prisma.inventario.upsert({
      where: { escolaId: req.params.escolaId },
      update: { status: data.status },
      create: {
        escolaId: req.params.escolaId,
        status: data.status
      },
      include: { escola: true }
    })

    return res.json(inventario)
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

export default router