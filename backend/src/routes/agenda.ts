import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth'
import { AtribuicaoAgendaCreateSchema, AgendaFiltroSchema } from '@shared/api'
import { isZodError } from '../utils/zodError'
import { filtroVisibilidade } from './dashboard'
import { usuarioAtendeUnidade } from '../services/unidades'

const router = Router()

/**
 * Perfil que gerencia a agenda: quem atribui e remove o técnico do dia.
 *
 * Técnico CONSULTA a agenda (GET é aberto a todo autenticado, com o recorte de
 * visibilidade abaixo), mas não escala o próprio time — isso é papel de quem
 * coordena a operação. Reusa `requireRole` em vez de inventar guarda nova.
 */
const PERFIS_AGENDA = ['ADMIN', 'GESTOR']

/**
 * Normaliza uma data para o DIA (meia-noite UTC).
 *
 * A chave natural é (escola, data) e a granularidade é o dia: "2026-10-19" e
 * "2026-10-19T00:00:00.000Z" precisam cair no MESMO registro, senão o unique
 * não impediria duas atribuições do mesmo dia.
 */
function normalizarDia(valor: string): Date {
  const d = new Date(valor)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/** Troca recursivamente uma chave de objeto (`unidade` → `escola`). */
function trocarChave(valor: unknown, de: string, para: string): unknown {
  if (Array.isArray(valor)) return valor.map((v) => trocarChave(v, de, para))
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([k, v]) => [
        k === de ? para : k,
        trocarChave(v, de, para)
      ])
    )
  }
  return valor
}

/**
 * Recorte de escola para a agenda, reaproveitando `filtroVisibilidade` — o
 * MESMO dos KPIs e da listagem de chamados. A cláusula dele fala de `unidade`;
 * aqui a coluna equivalente é `escola`.
 *
 * O escopo de TIPOS não se aplica: a agenda não tem `tipo`, então quem tem
 * escopo de tipo enxerga todas as escolas (o escopo restringe o assunto, não a
 * unidade). Sem esse desvio, a cláusula `tipo` quebraria a query.
 */
async function filtroEscolaAgenda(
  user: { filial?: string; nivel?: string; escopoTipos?: string[] | null } | undefined
): Promise<Prisma.AtribuicaoAgendaWhereInput | null> {
  const visibilidade = await filtroVisibilidade(user)
  if (!visibilidade) return null
  if (JSON.stringify(visibilidade).includes('"tipo"')) return null
  return trocarChave(visibilidade, 'unidade', 'escola') as Prisma.AtribuicaoAgendaWhereInput
}

/**
 * Agenda de atendimento — lista por intervalo de datas e por técnico.
 *
 * GET /api/agenda?de=2026-10-01&ate=2026-10-31&tecnicoId=...
 * GET /api/agenda?escola=E.E. X   (403 se o usuário não atende essa escola)
 *
 * Ninguém vê dia de escola que não pode atender: o recorte de visibilidade é o
 * mesmo de `dashboard.ts`. Cada item vem com `tecnicoCor` (do `Usuario.cor`,
 * T-003) para o calendário pintar a célula sem um segundo request por técnico.
 */
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const filtro = AgendaFiltroSchema.parse(req.query)
    const { de, ate, tecnicoId, escola } = filtro

    const where: Prisma.AtribuicaoAgendaWhereInput = {}

    const filtroData: { gte?: Date; lte?: Date } = {}
    if (de) filtroData.gte = normalizarDia(de)
    if (ate) {
      const fim = normalizarDia(ate)
      fim.setUTCHours(23, 59, 59, 999)
      filtroData.lte = fim
    }
    if (filtroData.gte || filtroData.lte) where.data = filtroData
    if (tecnicoId) where.tecnicoId = tecnicoId

    const visibilidade = await filtroEscolaAgenda(req.userRecord)
    if (visibilidade) Object.assign(where, visibilidade)

    // Escola pedida explicitamente: 403 se o usuário não atende essa unidade.
    // Sem o parâmetro, o recorte acima apenas esconde o que ele não pode ver.
    if (escola) {
      if (req.userRecord?.nivel !== 'ADMIN' && !usuarioAtendeUnidade(req.userRecord?.filial, escola)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem acesso a esta escola' })
      }
      where.escola = escola
    }

    const atribuicoes = await prisma.atribuicaoAgenda.findMany({
      where,
      orderBy: { data: 'asc' }
    })

    // Cor do técnico (T-003). Uma única query para todos os técnicos do
    // recorte, em vez de uma por linha.
    const ids = [...new Set(atribuicoes.map((a) => a.tecnicoId))]
    const tecnicos = ids.length
      ? await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, cor: true } })
      : []
    const corPorTecnico = new Map(tecnicos.map((t) => [t.id, t.cor]))

    return res.json(
      atribuicoes.map((a) => ({ ...a, tecnicoCor: corPorTecnico.get(a.tecnicoId) ?? null }))
    )
  } catch (err) {
    throw err
  }
})

/**
 * Atribui um técnico a uma escola em um dia.
 *
 * A duplicidade do mesmo dia é impedida pelo @@unique (escola, data); o P2002
 * sobe pelo errorHandler e vira 409.
 */
router.post('/', authMiddleware, requireRole(...PERFIS_AGENDA), async (req: AuthenticatedRequest, res) => {
  try {
    const data = AtribuicaoAgendaCreateSchema.parse(req.body)

    const existentes = await prisma.atribuicaoAgenda.count({
      where: { tecnicoId: data.tecnicoId, data: normalizarDia(data.data) },
    })
  const criada = await prisma.atribuicaoAgenda.create({
    data: {
      escola: data.escola,
      data: normalizarDia(data.data),
      tecnicoId: data.tecnicoId,
      tecnicoNome: data.tecnicoNome,
      observacao: data.observacao ?? null,
      principal: existentes === 0,
      solicitarPonto: data.solicitarPonto ?? true,
    }
  })

    return res.status(201).json(criada)
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

/**
 * Remove uma atribuição. O P2025 (id inexistente) sobe pelo errorHandler e vira
 * 404.
 */
router.delete('/:id', authMiddleware, requireRole(...PERFIS_AGENDA), async (req: AuthenticatedRequest, res) => {
  try {
    await prisma.atribuicaoAgenda.delete({ where: { id: req.params.id } })
    return res.status(204).send()
  } catch (err) {
    throw err
  }
})

export default router
