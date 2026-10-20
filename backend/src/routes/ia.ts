import { Router } from 'express'
import { isZodError } from '../utils/zodError'
import { authMiddleware, attachUserRecord, requireRole, AuthenticatedRequest } from '../middleware/auth'
import { ChatIASchema, consultarIA, listarModelosIA } from '../services/ia'
import { prisma } from '../config/prisma'
import { filtroVisibilidade } from './dashboard'

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

export default router
