import { Router, Response } from 'express'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth'
import { EquipamentoCreateSchema, EquipamentoSchema } from '@shared/api'
import { ZodError } from 'zod'

const router = Router()

router.get('/', authMiddleware, async (_req: AuthenticatedRequest, res) => {
  try {
    const { categoria, marca, modelo } = _req.query

    const where: any = {}
    if (categoria) where.categoria = categoria
    if (marca) where.marca = marca
    if (modelo) where.modelo = modelo

    const equipamentos = await prisma.equipamento.findMany({
      where,
      orderBy: [{ categoria: 'asc' }, { marca: 'asc' }, { modelo: 'asc' }]
    })

    return res.json(equipamentos)
  } catch (err) {
    throw err
  }
})

router.get('/categorias', authMiddleware, async (_req: AuthenticatedRequest, res) => {
  try {
    const categorias = await prisma.equipamento.findMany({
      select: { categoria: true },
      distinct: ['categoria'],
      orderBy: { categoria: 'asc' }
    })
    return res.json(categorias.map(c => c.categoria))
  } catch (err) {
    throw err
  }
})

router.get('/marcas', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { categoria } = req.query
    if (!categoria) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Parâmetro categoria obrigatório' })
    }

    const marcas = await prisma.equipamento.findMany({
      where: { categoria: categoria as string },
      select: { marca: true },
      distinct: ['marca'],
      orderBy: { marca: 'asc' }
    })
    return res.json(marcas.map(m => m.marca))
  } catch (err) {
    throw err
  }
})

router.get('/modelos', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { categoria, marca } = req.query
    if (!categoria || !marca) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Parâmetros categoria e marca obrigatórios' })
    }

    const modelos = await prisma.equipamento.findMany({
      where: { categoria: categoria as string, marca: marca as string },
      select: { modelo: true },
      distinct: ['modelo'],
      orderBy: { modelo: 'asc' }
    })
    return res.json(modelos.map(m => m.modelo))
  } catch (err) {
    throw err
  }
})

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const data = EquipamentoCreateSchema.parse(req.body)

    const existing = await prisma.equipamento.findUnique({
      where: { categoria_marca_modelo: { categoria: data.categoria, marca: data.marca, modelo: data.modelo } }
    })
    if (existing) {
      return res.status(409).json({ error: 'VALIDATION_ERROR', message: 'Equipamento já cadastrado' })
    }

    const equipamento = await prisma.equipamento.create({ data })
    return res.status(201).json(equipamento)
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

export default router