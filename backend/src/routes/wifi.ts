import { Router } from 'express'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

function txt(x: unknown): string {
  return x === null || x === undefined ? '' : String(x).trim()
}
function num(x: unknown): number | null {
  if (x === null || x === undefined || x === '') return null
  const n = parseFloat(String(x).replace(',', '.'))
  return isNaN(n) ? null : n
}

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const payload = req.body || {}
  const v = payload.visita || {}
  const aps = Array.isArray(payload.aps) ? payload.aps : []
  const semAp = Array.isArray(payload.semAp) ? payload.semAp : []

  const escola = txt(v.escola)
  const tecnico = txt(v.tecnico)
  const data = txt(v.data)
  const salasTotal = num(v.salasTotal)
  if (!escola) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Informe a escola.' })
  if (!tecnico) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Informe o técnico.' })
  if (!data) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Informe a data da visita.' })
  if (salasTotal === null) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Informe o total de salas.' })
  if (semAp.length > salasTotal) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Há mais salas sem AP do que o total de salas.' })

  for (let i = 0; i < aps.length; i++) {
    const a = aps[i]
    if (!txt(a?.numero) || !txt(a?.local)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: `AP ${i + 1}: informe o número e a localização.` })
    }
    if (!['ON', 'OFF', 'DOWN'].includes(txt(a?.status))) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: `AP ${i + 1}: escolha o status (ON, OFF ou DOWN).` })
    }
  }
  for (let i = 0; i < semAp.length; i++) {
    if (!txt(semAp[i]?.sala)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: `Sala sem AP ${i + 1}: informe a sala.` })
    }
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

  const visita = await prisma.visitaWifi.create({
    data: {
      dataVisita,
      tecnico,
      escola,
      cie: txt(v.cie) || null,
      salasTotal: salasTotal!,
      rackCond: txt(v.rackCond) || null,
      totalAps: aps.length,
      apsOn: st.ON,
      apsOff: st.OFF,
      apsDown: st.DOWN,
      salasSemAp: semAp.length,
      semApComInfra: cont.SIM,
      semApParcial: cont.PARCIAL,
      semApSemInfra: cont.NAO,
      latitude: num(v.lat),
      longitude: num(v.lng),
      obs: txt(v.obs) || null,
      aps: { create: linhasA },
      salasSem: { create: linhasS },
    },
    include: { aps: true, salasSem: true },
  })

  return res.json({
    ok: true,
    id: visita.id,
    escola,
    totalAps: aps.length,
    on: st.ON,
    off: st.OFF,
    down: st.DOWN,
    semAp: semAp.length,
    comInfra: cont.SIM,
    parcial: cont.PARCIAL,
    semInfra: cont.NAO,
  })
})

router.get('/', authMiddleware, async (_req: AuthenticatedRequest, res) => {
  const visitas = await prisma.visitaWifi.findMany({
    include: { aps: true, salasSem: true },
    orderBy: { createdAt: 'desc' },
  })
  return res.json(visitas)
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
