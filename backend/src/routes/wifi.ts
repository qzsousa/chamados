import { Router } from 'express'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth'

const router = Router()

function txt(x: unknown): string {
  return x === null || x === undefined ? '' : String(x).trim()
}
function num(x: unknown): number | null {
  if (x === null || x === undefined || x === '') return null
  const n = parseFloat(String(x).replace(',', '.'))
  return isNaN(n) ? null : n
}

// validação + normalização compartilhada entre POST e PUT
function normalizarPayload(payload: any) {
  const v = payload?.visita || {}
  const aps = Array.isArray(payload?.aps) ? payload.aps : []
  const semAp = Array.isArray(payload?.semAp) ? payload.semAp : []

  const escola = txt(v.escola)
  const tecnico = txt(v.tecnico)
  const data = txt(v.data)
  const salasTotal = num(v.salasTotal)
  if (!escola) throw new Error('Informe a escola.')
  if (!tecnico) throw new Error('Informe o técnico.')
  if (!data) throw new Error('Informe a data da visita.')
  if (salasTotal === null) throw new Error('Informe o total de salas.')
  if (semAp.length > salasTotal) throw new Error('Há mais salas sem AP do que o total de salas.')

  for (let i = 0; i < aps.length; i++) {
    const a = aps[i]
    if (!txt(a?.numero) || !txt(a?.local)) throw new Error(`AP ${i + 1}: informe o número e a localização.`)
    if (!['ON', 'OFF', 'DOWN'].includes(txt(a?.status))) throw new Error(`AP ${i + 1}: escolha o status (ON, OFF ou DOWN).`)
  }
  for (let i = 0; i < semAp.length; i++) {
    if (!txt(semAp[i]?.sala)) throw new Error(`Sala sem AP ${i + 1}: informe a sala.`)
  }

  const cont = { SIM: 0, PARCIAL: 0, NAO: 0 }
  const linhasS = semAp.map((s: any) => {
    const chave = s.infra === 'SIM' || s.infra === 'PARCIAL' ? s.infra : 'NAO'
    cont[chave as 'SIM' | 'PARCIAL' | 'NAO']++
    return {
      sala: txt(s.sala),
      tipo: txt(s.tipo) || null,
      bloco: txt(s.bloco) || null,
      infra: chave,
      falta: Array.isArray(s.falta) ? s.falta.map((x: any) => String(x)) : [],
      obs: txt(s.obs) || null,
    }
  })

  const st = { ON: 0, OFF: 0, DOWN: 0 }
  const linhasA = aps.map((a: any) => {
    const status = txt(a.status) as 'ON' | 'OFF' | 'DOWN'
    st[status]++
    return {
      numero: txt(a.numero),
      local: txt(a.local),
      bloco: txt(a.bloco) || null,
      status,
      obs: txt(a.obs) || null,
    }
  })

  const dataVisita = new Date(data + 'T12:00:00')

  return {
    escola, tecnico, data, salasTotal, aps, semAp,
    dataVisita,
    linhasA, linhasS, st, cont,
    cie: txt(v.cie) || null,
    rackCond: txt(v.rackCond) || null,
    latitude: num(v.lat),
    longitude: num(v.lng),
    obs: txt(v.obs) || null,
  }
}

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const payload = req.body || {}
  let n: ReturnType<typeof normalizarPayload>
  try {
    n = normalizarPayload(payload)
  } catch (e: any) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: e?.message || 'Dados inválidos.' })
  }

  const visita = await prisma.visitaWifi.create({
    data: {
      dataVisita: n.dataVisita,
      tecnico: n.tecnico,
      escola: n.escola,
      cie: n.cie,
      salasTotal: n.salasTotal!,
      rackCond: n.rackCond,
      totalAps: n.aps.length,
      apsOn: n.st.ON,
      apsOff: n.st.OFF,
      apsDown: n.st.DOWN,
      salasSemAp: n.semAp.length,
      semApComInfra: n.cont.SIM,
      semApParcial: n.cont.PARCIAL,
      semApSemInfra: n.cont.NAO,
      latitude: n.latitude,
      longitude: n.longitude,
      obs: n.obs,
      aps: { create: n.linhasA },
      salasSem: { create: n.linhasS },
    },
    include: { aps: true, salasSem: true },
  })

  return res.json({
    ok: true,
    id: visita.id,
    escola: n.escola,
    totalAps: n.aps.length,
    on: n.st.ON,
    off: n.st.OFF,
    down: n.st.DOWN,
    semAp: n.semAp.length,
    comInfra: n.cont.SIM,
    parcial: n.cont.PARCIAL,
    semInfra: n.cont.NAO,
  })
})

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const where = req.userRecord && req.userRecord.nivel !== 'ADMIN'
    ? { tecnico: req.userRecord.nome }
    : {}
  const visitas = await prisma.visitaWifi.findMany({
    where,
    include: { aps: true, salasSem: true },
    orderBy: { createdAt: 'desc' },
  })
  return res.json(visitas)
})

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const id = req.params.id
  const v = await prisma.visitaWifi.findUnique({
    where: { id },
    include: { aps: true, salasSem: true },
  })
  if (!v) return res.status(404).json({ error: 'NOT_FOUND', message: 'Visita não encontrada.' })
  if (req.userRecord && req.userRecord.nivel !== 'ADMIN' && v.tecnico !== req.userRecord.nome) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão para acessar esta visita.' })
  }
  return res.json(v)
})

router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const id = req.params.id
  const existente = await prisma.visitaWifi.findUnique({ where: { id } })
  if (!existente) return res.status(404).json({ error: 'NOT_FOUND', message: 'Visita não encontrada.' })
  if (req.userRecord && req.userRecord.nivel !== 'ADMIN' && existente.tecnico !== req.userRecord.nome) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão para editar esta visita.' })
  }

  const payload = req.body || {}
  let n: ReturnType<typeof normalizarPayload>
  try {
    n = normalizarPayload(payload)
  } catch (e: any) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: e?.message || 'Dados inválidos.' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.apWifi.deleteMany({ where: { visitaId: id } })
    await tx.salaSemApWifi.deleteMany({ where: { visitaId: id } })
    await tx.visitaWifi.update({
      where: { id },
      data: {
        dataVisita: n.dataVisita,
        tecnico: n.tecnico,
        escola: n.escola,
        cie: n.cie,
        salasTotal: n.salasTotal!,
        rackCond: n.rackCond,
        totalAps: n.aps.length,
        apsOn: n.st.ON,
        apsOff: n.st.OFF,
        apsDown: n.st.DOWN,
        salasSemAp: n.semAp.length,
        semApComInfra: n.cont.SIM,
        semApParcial: n.cont.PARCIAL,
        semApSemInfra: n.cont.NAO,
        latitude: n.latitude,
        longitude: n.longitude,
        obs: n.obs,
        aps: { create: n.linhasA },
        salasSem: { create: n.linhasS },
      },
    })
  })

  return res.json({
    ok: true,
    id,
    escola: n.escola,
    totalAps: n.aps.length,
    on: n.st.ON,
    off: n.st.OFF,
    down: n.st.DOWN,
    semAp: n.semAp.length,
    comInfra: n.cont.SIM,
    parcial: n.cont.PARCIAL,
    semInfra: n.cont.NAO,
  })
})

router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const id = req.params.id
  try {
    await prisma.visitaWifi.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Visita não encontrada.' })
  }
})

router.get('/ultimas', authMiddleware, async (_req: AuthenticatedRequest, res) => {
  const visitas = await prisma.visitaWifi.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      id: true,
      dataVisita: true,
      tecnico: true,
      escola: true,
      totalAps: true,
      salasSemAp: true,
    },
  })
  return res.json(visitas.map((v) => ({
    id: v.id,
    data: v.dataVisita.toISOString().slice(0, 10),
    tecnico: v.tecnico,
    escola: v.escola,
    aps: v.totalAps,
    semAp: v.salasSemAp,
  })))
})

export default router
