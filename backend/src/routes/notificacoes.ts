import { Router } from 'express'
import { prisma } from '../config/prisma'
import { authMiddleware, attachUserRecord, AuthenticatedRequest } from '../middleware/auth'
import { unidadesDoUsuario, normalizarUnidade, usuarioAtendeUnidade } from '../services/unidades'

const router = Router()

/**
 * Prisma `where` sobre o campo `filial` da Notificacao (a unidade notificada).
 * Espelha `filtroUnidadesDoUsuario`, que é do model Chamado (`unidade`) —
 * usar o dele aqui quebrava a query com "Unknown argument `unidade`" e o sino
 * de todo usuário com filial (técnicos e escolas) respondia HTTP 500.
 */
function filtroNotificacoesDaFilial(filial: string | null | undefined) {
  const unidades = unidadesDoUsuario(filial)
  if (!unidades.length) return { OR: [{ filial: { equals: '__sem_unidades__' } }] }
  return {
    OR: unidades.map((u) => ({ filial: { contains: normalizarUnidade(u) || u, mode: 'insensitive' as const } })),
  }
}

/** Filtro: notificações visíveis ao usuário (próprias + broadcast admin + da sua filial). */
function filtroVisiveis(user: AuthenticatedRequest['user'], record: AuthenticatedRequest['userRecord']) {
  const or: Array<Record<string, unknown>> = [
    { usuarioId: user?.sub },
    // Técnico tem VÁRIAS unidades no filial (separadas por vírgula) — casar por
    // igualdade com a string inteira esconderia as notificações das escolas dele.
    ...(record?.filial ? [filtroNotificacoesDaFilial(record.filial)] : []),
  ]
  if (record?.nivel === 'ADMIN') or.push({ usuarioId: null })
  return {
    OR: or,
    AND: [{ OR: [{ usuarioId: { not: null } }, { filial: { not: null } }, { usuarioId: null }] }],
  }
}

router.get('/', authMiddleware, attachUserRecord, async (req: AuthenticatedRequest, res) => {
  const filtro = filtroVisiveis(req.user, req.userRecord)
  const [data, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({ where: filtro, orderBy: { criadoEm: 'desc' }, take: 30 }),
    prisma.notificacao.count({ where: { ...filtro, lida: false } }),
  ])
  return res.json({ data, naoLidas })
})

router.post('/:id/lida', authMiddleware, attachUserRecord, async (req: AuthenticatedRequest, res) => {
  const notif = await prisma.notificacao.findUnique({ where: { id: req.params.id } })
  if (!notif) return res.status(404).json({ error: 'NOT_FOUND', message: 'Notificação não encontrada' })

  const visivel =
    notif.usuarioId === req.user?.sub ||
    (!!req.userRecord?.filial && !!notif.filial && usuarioAtendeUnidade(req.userRecord.filial, notif.filial)) ||
    (req.userRecord?.nivel === 'ADMIN' && notif.usuarioId === null)

  if (!visivel) return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem acesso a esta notificação' })

  const updated = await prisma.notificacao.update({ where: { id: notif.id }, data: { lida: true } })
  return res.json(updated)
})

router.post('/ler-todas', authMiddleware, attachUserRecord, async (req: AuthenticatedRequest, res) => {
  const filtro = filtroVisiveis(req.user, req.userRecord)
  const { count } = await prisma.notificacao.updateMany({
    where: { ...filtro, lida: false },
    data: { lida: true },
  })
  return res.json({ marcadas: count })
})

export default router
