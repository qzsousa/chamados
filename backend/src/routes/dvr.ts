import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth'
import { isZodError } from '../utils/zodError'
import { importarRelatorioDvr, obterRetratoDvr, listarImportacoesDvr } from '../services/dvr'

const router = Router()

const ImportacaoSchema = z.object({
  arquivo: z.string().min(1).max(255),
  conteudoBase64: z.string().min(1),
})

router.post('/importacoes', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const data = ImportacaoSchema.parse(req.body)
    const login = req.userRecord?.nome || req.user?.email || undefined
    const result = await importarRelatorioDvr(data.arquivo, data.conteudoBase64, login)
    return res.status(201).json(result)
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados invalidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.userRecord
    const escopo = user?.nivel === 'ADMIN' ? undefined : (user?.filial ? user.filial.split(/[|,]/).map((s) => s.trim()).filter(Boolean) : undefined)
    const retrato = await obterRetratoDvr(undefined, { escopoNomes: escopo })
    return res.json(retrato)
  } catch (err) {
    throw err
  }
})

router.get('/importacoes', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const limite = Number(req.query.limite || 30)
    const rows = await listarImportacoesDvr(Number.isFinite(limite) ? limite : 30)
    return res.json(rows)
  } catch (err) {
    throw err
  }
})

export default router
