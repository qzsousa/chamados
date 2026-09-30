import { Router } from 'express'
import { z, ZodError } from 'zod'
import { prisma } from '../config/prisma'
import { authMiddleware, attachUserRecord, requireRole, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

const FeedbackSchema = z.object({
  tipo: z.enum(['ELOGIO', 'SUGESTAO']),
  nome: z.string().trim().max(120).optional(),
  unidade: z.string().trim().max(200).optional(),
  mensagem: z.string().trim().min(3).max(2000),
})

/** Público — formulário de elogios e sugestões. */
export async function criarFeedbackPublic(req: import('express').Request, res: import('express').Response) {
  try {
    const data = FeedbackSchema.parse(req.body)
    const fb = await prisma.feedback.create({ data })
    return res.status(201).json(fb)
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
}

// Leitura da fila de elogios/sugestões: matriz (ADMIN e TECNICO). O papel
// GESTOR/VISUALIZADOR da escola não entra — não é a quem a caixa responde.
router.get('/', authMiddleware, attachUserRecord, requireRole('ADMIN', 'TECNICO'), async (req: AuthenticatedRequest, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
  const tipo = req.query.tipo as string | undefined

  const where: { tipo?: string } = {}
  if (tipo === 'ELOGIO' || tipo === 'SUGESTAO') where.tipo = tipo

  const [total, data] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({ where, orderBy: { criadoEm: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ])
  return res.json({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } })
})

router.get('/stats', authMiddleware, attachUserRecord, requireRole('ADMIN', 'TECNICO'), async (_req, res) => {
  const [avaliacoes, elogios, sugestoes] = await Promise.all([
    prisma.avaliacao.groupBy({ by: ['nota'], _count: true }),
    prisma.feedback.count({ where: { tipo: 'ELOGIO' } }),
    prisma.feedback.count({ where: { tipo: 'SUGESTAO' } }),
  ])

  const porNota: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  let total = 0
  let soma = 0
  for (const a of avaliacoes) {
    porNota[String(a.nota)] = a._count
    total += a._count
    soma += a.nota * a._count
  }

  return res.json({
    avaliacoes: { total, media: total ? Math.round((soma / total) * 100) / 100 : null, porNota },
    feedback: { elogios, sugestoes },
  })
})

/**
 * Lista as avaliações com o comentário que a escola deixou — a justificativa
 * que acompanha a nota. Sem esta rota o comentário era gravado e nunca lido
 * por ninguém da matriz: só quem abriu o chamado o via, em `/consulta`.
 *
 * Filtros: `nota` (1..5) e `somenteComentarios` (ignora as notas sem texto).
 * Avaliação de chamado excluído (soft delete) não entra na lista.
 */
router.get('/avaliacoes', authMiddleware, attachUserRecord, requireRole('ADMIN', 'TECNICO'), async (req: AuthenticatedRequest, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
  const nota = parseInt(req.query.nota as string)
  const somenteComentarios = req.query.somenteComentarios === 'true'

  const where: { nota?: number; comentario?: { not: null }; chamado: { excluido: false } } = {
    chamado: { excluido: false },
  }
  if (nota >= 1 && nota <= 5) where.nota = nota
  if (somenteComentarios) where.comentario = { not: null }

  const [total, data] = await Promise.all([
    prisma.avaliacao.count({ where }),
    prisma.avaliacao.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        chamado: {
          select: {
            protocolo: true,
            unidade: true,
            solicitante: true,
            tipo: true,
            tecnicoResolucao: true,
            tecnicoSetor: true,
          },
        },
      },
    }),
  ])

  return res.json({
    data: data.map((a) => ({
      id: a.id,
      nota: a.nota,
      comentario: a.comentario,
      criadoEm: a.criadoEm,
      protocolo: a.chamado.protocolo,
      unidade: a.chamado.unidade,
      solicitante: a.chamado.solicitante,
      tipo: a.chamado.tipo,
      // Quem atendeu: o técnico que fechou o chamado, senão o da unidade.
      tecnico: a.chamado.tecnicoResolucao || a.chamado.tecnicoSetor || null,
    })),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
})

export default router
