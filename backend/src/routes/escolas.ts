import { Router, Response } from 'express'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth'
import { EscolaSchema, EscolaCreateSchema } from '@shared/api'
import { ZodError } from 'zod'
import { normalizarNomeEscola, getMapaTecnicos, NOMES_PADRONIZADOS } from '../services/normalization'

const router = Router()

router.get('/', authMiddleware, async (_req: AuthenticatedRequest, res) => {
  try {
    const escolas = await prisma.escola.findMany({
      orderBy: { nome: 'asc' }
    })

    const mapaTecnicos = getMapaTecnicos()
    const enriched = escolas.map(e => ({
      ...e,
      tecnico: mapaTecnicos[normalizarNomeEscola(e.nome)] || e.tecnico
    }))

    return res.json(enriched)
  } catch (err) {
    throw err
  }
})

router.get('/tecnicos', authMiddleware, async (_req: AuthenticatedRequest, res) => {
  try {
    const mapaTecnicos = getMapaTecnicos()
    return res.json(mapaTecnicos)
  } catch (err) {
    throw err
  }
})

router.get('/nomes-padronizados', authMiddleware, async (_req: AuthenticatedRequest, res) => {
  return res.json(NOMES_PADRONIZADOS)
})

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const data = EscolaCreateSchema.parse(req.body)

    const existing = await prisma.escola.findUnique({ where: { nome: data.nome } })
    if (existing) {
      return res.status(409).json({ error: 'VALIDATION_ERROR', message: 'Escola já cadastrada' })
    }

    const nomeNormalizado = normalizarNomeEscola(data.nome)

    const escola = await prisma.escola.create({
      data: {
        nome: data.nome,
        nomeNormalizado,
        tecnico: data.tecnico
      }
    })

    return res.status(201).json(escola)
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

export default router