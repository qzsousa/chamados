import { Router, Response } from 'express'
import { prisma } from '../config/prisma'
import { authMiddleware, attachUserRecord, AuthenticatedRequest } from '../middleware/auth'
import { DashboardKPIsSchema, DashboardMatrizResponseSchema, DashboardFiltradoResponseSchema } from '@shared/api'
import { normalizarNomeEscola, getMapaTecnicos, getEmailsContato } from '../services/normalization'
import { getMapaInventario } from '../services/migration'

const router = Router()

async function getDashboardData(filtroFilial?: string, filtroNivel?: string) {
  const where: any = { excluido: false }

  if (filtroFilial && filtroNivel !== 'ADMIN') {
    // casamento tolerante: unidades geminadas ("E.E. A / E.E. B")
    const partes = filtroFilial.split('/').map((p) => p.trim()).filter(Boolean)
    where.OR = [
      { unidade: filtroFilial },
      { unidade: { contains: filtroFilial, mode: 'insensitive' } },
      ...partes.map((p) => ({ unidade: { contains: p, mode: 'insensitive' } })),
    ]
  }

  const [chamados, totalCount] = await Promise.all([
    prisma.chamado.findMany({
      where,
      orderBy: { timestamp: 'desc' }
    }),
    prisma.chamado.count({ where })
  ])

  const mapaTecnicos = getMapaTecnicos()
  const mapaInventario = await getMapaInventario()

  const enriched = chamados.map(c => {
    const escolaNorm = normalizarNomeEscola(c.unidade)
    return {
      ...c,
      tecnicoSetor: c.tecnicoSetor || mapaTecnicos[escolaNorm] || '',
      inventarioStatus: c.inventarioStatus || mapaInventario[escolaNorm] || null,
      emailsContato: getEmailsContato(c.unidade)
    }
  })

  const kpis = {
    total: totalCount,
    abertos: enriched.filter(c => c.status === 'ABERTO').length,
    andamento: enriched.filter(c => c.status === 'ANDAMENTO').length,
    comunicado: enriched.filter(c => c.status === 'COMUNICADO').length,
    resolvidos: enriched.filter(c => c.status === 'RESOLVIDO').length,
    altaPrioridade: enriched.filter(c => c.urgencia.startsWith('Alta') && c.status !== 'RESOLVIDO').length
  }

  return { chamados: enriched, kpis, mapaInventario }
}

router.get('/matriz', async (_req, res) => {
  try {
    const { chamados, kpis, mapaInventario } = await getDashboardData()

    const porStatus: Record<string, number> = {}
    const porUrgencia: Record<string, number> = {}
    const resolvidosPorTecnico: Record<string, number> = {}

    chamados.forEach(c => {
      porStatus[c.status] = (porStatus[c.status] || 0) + 1
      const urg = c.urgencia.split(' ')[0]
      porUrgencia[urg] = (porUrgencia[urg] || 0) + 1
      if (c.status === 'RESOLVIDO' && c.tecnicoResolucao) {
        resolvidosPorTecnico[c.tecnicoResolucao] = (resolvidosPorTecnico[c.tecnicoResolucao] || 0) + 1
      }
    })

    return res.json({
      kpis,
      chamados,
      graficos: { porStatus, porUrgencia, resolvidosPorTecnico }
    })
  } catch (err) {
    throw err
  }
})

router.get('/filtrado', authMiddleware, attachUserRecord, async (req: AuthenticatedRequest, res) => {
  try {
    const { chamados, kpis, mapaInventario } = await getDashboardData(
      req.userRecord?.filial,
      req.userRecord?.nivel
    )

    const avisos: any[] = []
    const agora = Date.now()
    const janelaMs = 24 * 60 * 60 * 1000

    chamados.forEach(c => {
      const ultAtualizacao = c.ultimaAtualizacao ? new Date(c.ultimaAtualizacao).getTime() : null
      if (!ultAtualizacao || (agora - ultAtualizacao) > janelaMs) return

      const historico = c.historico || ''
      const linhas = historico.split('\n')
      let ultimaMudanca: { status: string; responsavel: string; tecnico?: string } | null = null
      let anterior = 'ABERTO'

      for (const linha of linhas) {
        const match = linha.match(/Status alterado para\s*"([^"]+)"\s*por\s*([^\(]+?)(?:\s*\(técnico:\s*([^)]+)\))?\s*$/)
        if (match) {
          anterior = ultimaMudanca ? ultimaMudanca.status : 'ABERTO'
          ultimaMudanca = { status: match[1].trim(), responsavel: match[2]?.trim() || '', tecnico: match[3]?.trim() }
        }
      }

      if (ultimaMudanca && ultimaMudanca.status !== anterior) {
        avisos.push({
          id: c.id,
          tipo: c.tipo,
          anterior,
          atual: ultimaMudanca.status,
          responsavel: ultimaMudanca.responsavel,
          quando: c.ultimaAtualizacao
        })
      }
    })

    avisos.sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime())

    const inventarioEscola = req.userRecord
      ? mapaInventario[normalizarNomeEscola(req.userRecord.filial)] || null
      : null

    return res.json({
      kpis,
      chamados,
      avisos: avisos.slice(0, 10),
      inventario: req.userRecord ? {
        unidade: req.userRecord.filial,
        tecnicoSetor: req.userRecord.filial,
        status: inventarioEscola
      } : null
    })
  } catch (err) {
    throw err
  }
})

router.get('/stats', authMiddleware, attachUserRecord, async (req: AuthenticatedRequest, res) => {
  try {
    const where: any = {}
    if (req.userRecord && req.userRecord.nivel !== 'ADMIN') {
      // match tolerante com unidades geminadas
      const f = req.userRecord.filial
      const partes = f.split('/').map((p: string) => p.trim()).filter(Boolean)
      where.OR = [
        { unidade: f },
        { unidade: { contains: f, mode: 'insensitive' } },
        ...partes.map((p: string) => ({ unidade: { contains: p, mode: 'insensitive' } })),
      ]
    }

    const [total, abertos, andamento, comunicado, resolvidos, altaPrioridade] = await Promise.all([
      prisma.chamado.count({ where }),
      prisma.chamado.count({ where: { ...where, status: 'ABERTO' } }),
      prisma.chamado.count({ where: { ...where, status: 'ANDAMENTO' } }),
      prisma.chamado.count({ where: { ...where, status: 'COMUNICADO' } }),
      prisma.chamado.count({ where: { ...where, status: 'RESOLVIDO' } }),
      prisma.chamado.count({ where: { ...where, urgencia: { startsWith: 'Alta' }, status: { not: 'RESOLVIDO' } } })
    ])

    return res.json({ total, abertos, andamento, comunicado, resolvidos, altaPrioridade })
  } catch (err) {
    throw err
  }
})

export default router