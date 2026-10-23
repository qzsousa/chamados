import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth'
import { isZodError } from '../utils/zodError'
import { z } from 'zod'
import { notificarAdmins } from '../services/notificacoes'

const router = Router()

const JANELA_INICIO = 8 * 60
const JANELA_FIM = 8 * 60 + 30
const RAIO_METROS = 500

const BaterPontoSchema = z.object({
  agendaId: z.string().optional(),
  escola: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracy: z.number().optional(),
  justificativa: z.string().max(500).optional(),
})

function agoraSP(): { data: string; minutos: number; hora: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts = fmt.formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
  const data = `${get('year')}-${get('month')}-${get('day')}`
  const h = parseInt(get('hour'), 10)
  const m = parseInt(get('minute'), 10)
  return { data, minutos: h * 60 + m, hora: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
}

function diaUTC(data: string): Date {
  const [y, mo, d] = data.split('-').map((v) => parseInt(v, 10))
  return new Date(Date.UTC(y, mo - 1, d))
}

function haversineMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (v: number) => (v * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

function emFerias(user: { feriasInicio: Date | null; feriasFim: Date | null }): boolean {
  if (!user.feriasInicio || !user.feriasFim) return false
  const hoje = new Date()
  return hoje >= user.feriasInicio && hoje <= user.feriasFim
}

async function coordsEscola(nome: string): Promise<{ latitude: number | null; longitude: number | null }> {
  const e = await prisma.escola.findFirst({ where: { nome: { equals: nome, mode: 'insensitive' } } })
  if (e) return { latitude: e.latitude, longitude: e.longitude }
  // tenta por contains
  const all = await prisma.escola.findMany()
  const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const target = norm(nome)
  const found = all.find((x) => norm(x.nome).includes(target) || target.includes(norm(x.nome)))
  return { latitude: found?.latitude ?? null, longitude: found?.longitude ?? null }
}

async function visitasDoDia(usuarioId: string, filial: string): Promise<{ agendaId: string | null; escola: string; principal: boolean }[]> {
  const { data } = agoraSP()
  const dia = diaUTC(data)
  const atribuicoes = await prisma.atribuicaoAgenda.findMany({ where: { tecnicoId: usuarioId, data: dia } })
  const comPonto = atribuicoes.filter((a) => a.solicitarPonto !== false)
  if (comPonto.length > 0) {
    return comPonto.map((a) => ({ agendaId: a.id, escola: a.escola, principal: a.principal }))
  }
  if (atribuicoes.length > 0) {
    // Todas as atribuicoes do dia pediram para nao solicitar ponto: trata como sem agenda.
    return []
  }
  return [{ agendaId: null, escola: filial, principal: true }]
}

// GET /api/ponto/hoje
router.get('/hoje', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userRecord) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Não autenticado' })
    const { data, minutos, hora } = agoraSP()
    const dia = diaUTC(data)

    if (emFerias(req.userRecord)) {
      return res.json({
        status: 'FERIAS',
        visitas: [],
        dentroDaJanela: minutos >= JANELA_INICIO && minutos <= JANELA_FIM,
        horaAtual: hora,
        semAgenda: false,
      })
    }

    const visitasBase = await visitasDoDia(req.userRecord.id, req.userRecord.filial)
    const registros = await prisma.registroPonto.findMany({
      where: { usuarioId: req.userRecord.id, data: dia },
    })
    const regMap = new Map(registros.map((r) => [r.agendaId ?? r.escola ?? '', r]))

    const visitas = await Promise.all(visitasBase.map(async (v) => {
      const key = v.agendaId ?? v.escola
      const ponto = regMap.get(key) || null
      const coords = await coordsEscola(v.escola)
      return {
        agendaId: v.agendaId,
        escola: v.escola,
        principal: v.principal,
        latitude: coords.latitude,
        longitude: coords.longitude,
        ponto,
      }
    }))

    const status =
      visitas.length === 0 ? 'BATIDO' :
      visitas.every((v) => v.ponto && (v.ponto.status === 'NO_HORARIO' || v.ponto.status === 'TARDIO_AUTORIZADO')) ? 'BATIDO' :
      visitas.some((v) => v.ponto?.status === 'TARDIO_PENDENTE') ? 'PENDENTE' :
      visitas.some((v) => v.ponto?.status === 'TARDIO_REPROVADO') ? 'REPROVADO' :
      'NAO_BATIDO'

    const temAgenda = visitasBase.length > 0

    return res.json({
      status,
      visitas,
      dentroDaJanela: minutos >= JANELA_INICIO && minutos <= JANELA_FIM,
      horaAtual: hora,
      semAgenda: !temAgenda,
    })
  } catch (err) {
    throw err
  }
})

// POST /api/ponto
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userRecord) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Não autenticado' })
    if (req.userRecord.nivel !== 'TECNICO') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Apenas técnicos batem ponto' })
    }
    if (emFerias(req.userRecord)) {
      return res.status(422).json({ error: 'FERIAS', message: 'Técnico em férias não precisa bater ponto' })
    }
    const body = BaterPontoSchema.parse(req.body || {})
    const { data, minutos, hora } = agoraSP()
    const dia = diaUTC(data)

    const visitasBase = await visitasDoDia(req.userRecord.id, req.userRecord.filial)
    // determina visita alvo
    let alvo = body.agendaId ? visitasBase.find((v) => v.agendaId === body.agendaId) : null
    if (!alvo && body.escola) alvo = visitasBase.find((v) => v.escola === body.escola)
    if (!alvo) {
      // primeira visita sem ponto
      const regs = await prisma.registroPonto.findMany({ where: { usuarioId: req.userRecord.id, data: dia } })
      const regKeys = new Set(regs.map((r) => r.agendaId ?? r.escola ?? ''))
      alvo = visitasBase.find((v) => !regKeys.has(v.agendaId ?? v.escola)) || visitasBase[0]
    }
    if (!alvo) return res.status(422).json({ error: 'NO_VISIT', message: 'Nenhuma visita para hoje' })

    const escolaKey = alvo.agendaId ?? alvo.escola
    const existente = await prisma.registroPonto.findFirst({
      where: { usuarioId: req.userRecord.id, data: dia, escola: alvo.escola },
    })
    if (existente) {
      return res.status(409).json({ error: 'CONFLICT', message: 'Ponto já registrado para esta escola hoje' })
    }

    if (minutos < JANELA_INICIO) {
      return res.status(422).json({ error: 'WINDOW_CLOSED', message: 'A janela de ponto abre às 08:00' })
    }

    const coords = await coordsEscola(alvo.escola)
    const temAgenda = (await prisma.atribuicaoAgenda.findFirst({ where: { tecnicoId: req.userRecord.id, data: dia } })) !== null

    let distanciaMetros: number | null = null
    let dentroDoRaio: boolean | null = null
    if (body.latitude != null && body.longitude != null && coords.latitude != null && coords.longitude != null) {
      distanciaMetros = haversineMetros(body.latitude, body.longitude, coords.latitude, coords.longitude)
      dentroDoRaio = distanciaMetros <= RAIO_METROS
    }

    const janelaAplicavel = alvo.principal
    const dentroDaJanela = !janelaAplicavel || minutos <= JANELA_FIM

    const registro = await prisma.registroPonto.create({
      data: {
        usuarioId: req.userRecord.id,
        agendaId: alvo.agendaId,
        escola: alvo.escola,
        data: dia,
        batidoEm: new Date(),
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        accuracy: body.accuracy ?? null,
        dentroDoRaio,
        distanciaMetros,
        escolasReferencia: [alvo.escola],
        semAgenda: !temAgenda,
        status: dentroDaJanela ? 'NO_HORARIO' : 'TARDIO_PENDENTE',
        justificativa: body.justificativa ?? null,
      },
    })

    if (janelaAplicavel && !dentroDaJanela) {
      await notificarAdmins(
        'PONTO_TARDIO' as any,
        'Solicitação de ponto tardio',
        `${req.userRecord.nome} solicitou autorização de ponto às ${hora} em ${alvo.escola} (fora da janela 08:00–08:30).`,
        '/ponto',
      )
      return res.status(202).json({ status: 'PENDENTE', registro })
    }

    if (dentroDoRaio === false || !temAgenda) {
      await notificarAdmins(
        'PONTO_TARDIO' as any,
        'Ponto registrado com alerta',
        `${req.userRecord.nome} bateu ponto às ${hora} em ${alvo.escola}${dentroDoRaio === false ? ` a ${distanciaMetros}m (fora do raio)` : ''}${!temAgenda ? ' sem agenda para hoje' : ''}.`,
        '/ponto',
      )
    }

    return res.status(201).json({ status: 'BATIDO', registro })
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

// GET /api/ponto (admin) - histórico/filtro
router.get('/', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { data, status, tecnicoId, escola } = req.query as { data?: string; status?: string; tecnicoId?: string; escola?: string }
    const where: Prisma.RegistroPontoWhereInput = {}
    if (data) where.data = diaUTC(data)
    if (status) where.status = status
    if (tecnicoId) where.usuarioId = tecnicoId
    if (escola) where.escola = { contains: escola, mode: 'insensitive' }
    const registros = await prisma.registroPonto.findMany({
      where,
      orderBy: [{ data: 'desc' }, { batidoEm: 'desc' }],
      include: { usuario: { select: { id: true, nome: true, nivel: true, filial: true } } },
    })
    return res.json(registros)
  } catch (err) {
    throw err
  }
})

// GET /api/ponto/historico (técnico/admin) - próprios registros
router.get('/historico', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userRecord) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Não autenticado' })
    const { de, ate } = req.query as { de?: string; ate?: string }
    const where: Prisma.RegistroPontoWhereInput = { usuarioId: req.userRecord.id }
    if (de || ate) {
      where.data = {}
      if (de) (where.data as any).gte = diaUTC(de)
      if (ate) (where.data as any).lte = diaUTC(ate)
    }
    const registros = await prisma.registroPonto.findMany({
      where,
      orderBy: [{ data: 'desc' }, { batidoEm: 'desc' }],
    })
    return res.json(registros)
  } catch (err) {
    throw err
  }
})

router.patch('/:id/aprovar', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const registro = await prisma.registroPonto.update({
      where: { id: req.params.id },
      data: { status: 'TARDIO_AUTORIZADO', autorizadoPor: req.userRecord?.nome, autorizadoEm: new Date() },
    })
    return res.json(registro)
  } catch (err) {
    throw err
  }
})

router.patch('/:id/reprovar', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const registro = await prisma.registroPonto.update({
      where: { id: req.params.id },
      data: { status: 'TARDIO_REPROVADO', autorizadoPor: req.userRecord?.nome, autorizadoEm: new Date() },
    })
    return res.json(registro)
  } catch (err) {
    throw err
  }
})

// GET /api/ponto/resumo-hoje (admin) - status de ponto de hoje por tecnico
router.get('/resumo-hoje', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { data } = agoraSP()
    const dia = diaUTC(data)
    const tecnicos = await prisma.usuario.findMany({
      where: { nivel: 'TECNICO', status: 'ATIVO' },
      select: { id: true, nome: true, filial: true, feriasInicio: true, feriasFim: true },
    })
    const result = await Promise.all(tecnicos.map(async (t) => {
      if (emFerias(t)) {
        return { usuario: t, status: 'FERIAS', visitas: [] }
      }
      const visitasBase = await visitasDoDia(t.id, t.filial)
      const regs = await prisma.registroPonto.findMany({ where: { usuarioId: t.id, data: dia } })
      const regMap = new Map(regs.map((r) => [r.agendaId ?? r.escola ?? '', r]))
      const visitas = visitasBase.map((v) => {
        const r = regMap.get(v.agendaId ?? v.escola) || null
        return { escola: v.escola, status: r ? r.status : 'NAO_BATIDO' }
      })
      const status =
        visitas.length === 0 ? 'BATIDO' :
        visitas.every((v) => v.status === 'NO_HORARIO' || v.status === 'TARDIO_AUTORIZADO') ? 'BATIDO' :
        visitas.some((v) => v.status === 'TARDIO_PENDENTE') ? 'PENDENTE' :
        visitas.some((v) => v.status === 'TARDIO_REPROVADO') ? 'REPROVADO' :
        'NAO_BATIDO'
      return { usuario: t, status, visitas }
    }))
    return res.json(result)
  } catch (err) {
    throw err
  }
})

export default router
