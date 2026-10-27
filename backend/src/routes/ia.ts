import { Router } from 'express'
import { z } from 'zod'
import { isZodError } from '../utils/zodError'
import { authMiddleware, attachUserRecord, requireRole, AuthenticatedRequest } from '../middleware/auth'
import { ChatIASchema, consultarIA, listarModelosIA } from '../services/ia'
import { prisma } from '../config/prisma'
import { filtroVisibilidade } from './dashboard'

const MensagemConversaSchema = z.object({
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
})
const ConversaCriarSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  mensagens: z.array(MensagemConversaSchema).max(5000).optional(),
})
const ConversaAtualizarSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  mensagens: z.array(MensagemConversaSchema).max(5000).optional(),
})

const router = Router()

/**
 * Ponte entre o navegador e os provedores de LLM.
 *
 * ADMIN apenas: e o mesmo perfil que ja ve a tela no portal. O proxy e caro
 * (cota da chave e do servidor), entao nao entra na conta de quem so abre
 * chamado.
 *
 * A chave nao vem no corpo nem na URL - ela fica no ambiente do backend. E o que
 * separa isto de um `VITE_GEMINI_API_KEY`, que o Vite joga no bundle e qualquer
 * pessoa le no console.
 */
router.post(
  '/chat',
  authMiddleware,
  attachUserRecord,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const body = ChatIASchema.parse(req.body)
      const { provedor, resposta } = await consultarIA(body)
      return res.json({ provedor, ...(resposta as object) })
    } catch (err) {
      if (isZodError(err)) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
      }
      const message = err instanceof Error ? err.message : String(err)
      return res.status(502).json({ error: 'IA_UNAVAILABLE', message })
    }
  },
)

router.get(
  '/modelos',
  authMiddleware,
  attachUserRecord,
  requireRole('ADMIN'),
  async (_req, res) => {
    try {
      const modelos = await listarModelosIA()
      return res.json({ modelos })
    } catch (e: any) {
      return res.status(502).json({ error: 'MODELS_FETCH_FAILED', message: String(e?.message || e) })
    }
  },
)

router.get(
  '/resumo',
  authMiddleware,
  attachUserRecord,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const where: any = { excluido: false }
    const visibilidade = await filtroVisibilidade(req.userRecord)
    if (visibilidade) Object.assign(where, visibilidade)

    const [totalCh, statusRows, abertosRows, resolvidosRows] = await Promise.all([
      prisma.chamado.count({ where }),
      prisma.chamado.groupBy({ by: ['status'], _count: { _all: true }, where }),
      prisma.chamado.groupBy({ by: ['unidade'], _count: { _all: true }, where: { ...where, status: 'ABERTO' } }),
      prisma.chamado.groupBy({ by: ['responsavel'], _count: { _all: true }, where: { ...where, status: 'RESOLVIDO', responsavel: { not: null } } }),
    ])

    const statusChamados: Record<string, number> = {}
    for (const r of statusRows) statusChamados[r.status || 'sem status'] = r._count._all

    const abertosPorEscola: Record<string, number> = {}
    for (const r of abertosRows) abertosPorEscola[r.unidade || 'sem unidade'] = r._count._all

    const resolvidosPorTecnico: Record<string, number> = {}
    for (const r of resolvidosRows) if (r.responsavel) resolvidosPorTecnico[r.responsavel] = r._count._all

    const tecnicos = await prisma.usuario.findMany({ where: { nivel: 'TECNICO' }, select: { nome: true, filial: true } })
    const tecnicoEscolas: Record<string, string> = {}
    for (const u of tecnicos) if (u.filial) tecnicoEscolas[u.nome] = u.filial

    return res.json({
      totalCh,
      statusChamados,
      abertosPorEscola,
      resolvidosPorTecnico,
      tecnicoEscolas,
    })
  },
)

router.get(
  '/conversas',
  authMiddleware,
  attachUserRecord,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const userId = req.userRecord!.id
    const lista = await prisma.chatIaConversa.findMany({
      where: { usuarioId: userId },
      orderBy: { atualizado: 'desc' },
    })
    return res.json(
      lista.map((c) => ({
        id: c.id,
        title: c.title,
        mensagens: c.mensagens,
        atualizado: c.atualizado.getTime(),
      })),
    )
  },
)

router.post(
  '/conversas',
  authMiddleware,
  attachUserRecord,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const body = ConversaCriarSchema.parse(req.body ?? {})
      const c = await prisma.chatIaConversa.create({
        data: {
          usuarioId: req.userRecord!.id,
          title: body.title ?? 'Nova conversa',
          mensagens: (body.mensagens ?? []) as any,
        },
      })
      return res.status(201).json({
        id: c.id,
        title: c.title,
        mensagens: c.mensagens,
        atualizado: c.atualizado.getTime(),
      })
    } catch (e) {
      if (isZodError(e)) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos' })
      throw e
    }
  },
)

router.put(
  '/conversas/:id',
  authMiddleware,
  attachUserRecord,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const body = ConversaAtualizarSchema.parse(req.body ?? {})
      const existente = await prisma.chatIaConversa.findUnique({ where: { id: req.params.id } })
      if (!existente || existente.usuarioId !== req.userRecord!.id) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Conversa não encontrada' })
      }
      const c = await prisma.chatIaConversa.update({
        where: { id: req.params.id },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.mensagens !== undefined ? { mensagens: body.mensagens as any } : {}),
          atualizado: new Date(),
        },
      })
      return res.json({
        id: c.id,
        title: c.title,
        mensagens: c.mensagens,
        atualizado: c.atualizado.getTime(),
      })
    } catch (e) {
      if (isZodError(e)) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos' })
      throw e
    }
  },
)

router.delete(
  '/conversas/:id',
  authMiddleware,
  attachUserRecord,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const existente = await prisma.chatIaConversa.findUnique({ where: { id: req.params.id } })
    if (!existente || existente.usuarioId !== req.userRecord!.id) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Conversa não encontrada' })
    }
    await prisma.chatIaConversa.delete({ where: { id: req.params.id } })
    return res.status(204).send()
  },
)

export default router
