/**
 * Regras de encaminhamento automático (somente ADMIN).
 *
 * Cada regra liga uma categoria do formulário público a um destino:
 * o técnico da própria unidade (UNIDADE) ou um técnico fixo (TECNICO).
 * A regra nasce desligada por padrão — o Admin liga quando quiser.
 */
import { Router } from 'express'
import { ZodError } from 'zod'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth'
import { EncaminhamentoRegraSchema } from '@shared/api'
import { encaminharPendentes, destinoWhere } from '../services/encaminhamento'

const router = Router()

router.use(authMiddleware, requireRole('ADMIN'))

/** Lista as regras com o nome da categoria e o técnico fixo (para exibir na tela). */
router.get('/', async (_req: AuthenticatedRequest, res) => {
  try {
    const [regras, categorias, tecnicos] = await Promise.all([
      prisma.encaminhamentoRegra.findMany({ orderBy: { categoriaChave: 'asc' } }),
      prisma.formularioCategoria.findMany({
        where: { ativa: true },
        select: { chave: true, nome: true, cor: true, ordem: true },
        orderBy: { ordem: 'asc' },
      }),
      prisma.usuario.findMany({
        where: destinoWhere,
        select: { id: true, nome: true, email: true, filial: true },
        orderBy: { nome: 'asc' },
      }),
    ])

    return res.json({
      data: regras,
      categorias,
      tecnicos,
    })
  } catch (err) {
    throw err
  }
})

/** Cria (ou sobrescreve) a regra de uma categoria. */
router.put('/', async (req: AuthenticatedRequest, res) => {
  try {
    const data = EncaminhamentoRegraSchema.parse(req.body)

    let tecnicoNome: string | null = null
    if (data.modo === 'TECNICO' && data.tecnicoId) {
      const t = await prisma.usuario.findFirst({
        where: { id: data.tecnicoId, ...destinoWhere },
        select: { nome: true },
      })
      if (!t) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Técnico de destino inválido ou inativo.',
        })
      }
      tecnicoNome = t.nome
    }

    const salva = await prisma.encaminhamentoRegra.upsert({
      where: { categoriaChave: data.categoriaChave },
      create: {
        categoriaChave: data.categoriaChave,
        modo: data.modo,
        tecnicoId: data.modo === 'TECNICO' ? data.tecnicoId : null,
        tecnicoNome,
        ativa: data.ativa,
      },
      update: {
        modo: data.modo,
        tecnicoId: data.modo === 'TECNICO' ? data.tecnicoId : null,
        tecnicoNome,
        ativa: data.ativa,
      },
    })

    return res.json(salva)
  } catch (err) {
    if (err instanceof ZodError || (err as any)?.name === 'ZodError') {
      const z = err as ZodError
      return res
        .status(400)
        .json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: z.flatten().fieldErrors })
    }
    throw err
  }
})

/** Liga/desliga uma regra sem mexer no destino. */
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { ativa } = req.body || {}
    if (typeof ativa !== 'boolean') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Informe "ativa" (true/false).' })
    }
    const regra = await prisma.encaminhamentoRegra.findUnique({ where: { id: req.params.id } })
    if (!regra) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Regra não encontrada.' })
    }
    const atualizada = await prisma.encaminhamentoRegra.update({
      where: { id: req.params.id },
      data: { ativa },
    })
    return res.json(atualizada)
  } catch (err) {
    throw err
  }
})

/** Remove a regra da categoria. */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await prisma.encaminhamentoRegra.delete({ where: { id: req.params.id } })
    return res.json({ success: true })
  } catch (err) {
    throw err
  }
})

/** Aplica as regras ativas nos chamados abertos que ainda não têm responsável. */
router.post('/aplicar', async (_req: AuthenticatedRequest, res) => {
  try {
    const resultado = await encaminharPendentes()
    return res.json(resultado)
  } catch (err) {
    throw err
  }
})

export default router
