import { Router, Response, Request } from 'express'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest, requireRole, requireFilialAccess } from '../middleware/auth'
import { CriarChamadoSchema, FiltrosChamadoSchema, AtualizarStatusChamadoSchema, ResponderChamadoSchema, BatchUpdateChamadosSchema, BatchDeleteChamadosSchema, ChamadoSchema, PaginatedResponseSchema } from '@shared/api'
import { ZodError } from 'zod'
import { normalizarNomeEscola, getMapaTecnicos } from '../services/normalization'
import { getMapaInventario } from '../services/migration'
import { notificarChamadoStatusAlterado, notificarChamadoCriado } from '../services/email'
import { supabase } from '../config/supabase'

// sempre ignorar chamados marcados como excluídos
const filtroExcluido = { excluido: false }

const router = Router()

function getTecnicoSetor(unidade: string): string {
  const mapa = getMapaTecnicos()
  const chave = normalizarNomeEscola(unidade)
  return mapa[chave] || ''
}

// sempre ignorar chamados marcados como excluídos
const filtroExcluido = { excluido: false }

async function getInventarioStatus(unidade: string): Promise<string | null> {
  const mapa = await getMapaInventario()
  const chave = normalizarNomeEscola(unidade)
  return mapa[chave] || null
}

export async function consultarChamadoPublic(req: Request, res: Response) {
  try {
    const protocolo = String(req.params.protocolo || '').trim()
    if (!protocolo) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Informe o protocolo' })
    }

    const chamado = await prisma.chamado.findUnique({ where: { protocolo } })
    if (!chamado || chamado.excluido) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    return res.json({
      protocolo: chamado.protocolo,
      unidade: chamado.unidade,
      solicitante: chamado.solicitante,
      tipo: chamado.tipo,
      status: chamado.status,
      descricao: chamado.descricao,
      descricaoResolucao: chamado.descricaoResolucao,
      anexoUrl: chamado.anexoUrl,
      timestamp: chamado.timestamp,
      ultimaAtualizacao: chamado.ultimaAtualizacao
    })
  } catch (err) {
    throw err
  }
}

export async function criarChamadoPublic(req: Request, res: Response) {
  try {
    const data = CriarChamadoSchema.parse(req.body)

    const protocolo = await gerarProtocolo()
    const tecnicoSetor = getTecnicoSetor(data.unidade)
    const inventarioStatus = await getInventarioStatus(data.unidade)

    let anexoUrl: string | null = null
    if (data.anexoBase64 && data.anexoNome) {
      anexoUrl = await salvarAnexo(data.anexoBase64, data.anexoNome, data.anexoTipo || '', protocolo)
    }

    const chamado = await prisma.chamado.create({
      data: {
        protocolo,
        unidade: data.unidade,
        solicitante: data.solicitante,
        funcao: data.funcao,
        tipo: data.tipo,
        descricao: data.descricao,
        urgencia: data.urgencia,
        anexoUrl,
        email: data.email || null,
        tecnicoSetor,
        inventarioStatus: inventarioStatus as any,
        historico: `Chamado criado em ${new Date().toLocaleString('pt-BR')}`
      }
    })

    if (data.urgencia.startsWith('Alta')) {
      await notificarAltaPrioridade(chamado)
    }

    notificarChamadoCriado(chamado).catch(() => {})

    return res.status(201).json(chamado)
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
}

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const filtros = FiltrosChamadoSchema.parse({
      ...req.query,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20
    })

    const where: any = { ...filtroExcluido }

    if (req.userRecord && req.userRecord.nivel !== 'ADMIN') {
      if (req.userRecord.nivel === 'TECNICO') {
        where.OR = [
          { tecnicoSetor: req.userRecord.filial },
          { responsavel: req.userRecord.nome }
        ]
      } else if (req.userRecord.nivel === 'GESTOR' || req.userRecord.nivel === 'VISUALIZADOR') {
        where.unidade = req.userRecord.filial
      }
    }

    if (filtros.unidade) where.unidade = { contains: filtros.unidade, mode: 'insensitive' }
    if (filtros.categoria) where.tipo = { contains: filtros.categoria, mode: 'insensitive' }
    if (filtros.status) where.status = filtros.status
    if (filtros.urgencia) where.urgencia = { contains: filtros.urgencia, mode: 'insensitive' }
    if (filtros.tecnico) where.tecnicoSetor = filtros.tecnico
    if (filtros.inventario) where.inventarioStatus = filtros.inventario
    if (filtros.dataDe || filtros.dataAte) {
      where.timestamp = {}
      if (filtros.dataDe) where.timestamp.gte = new Date(filtros.dataDe + 'T00:00:00')
      if (filtros.dataAte) where.timestamp.lte = new Date(filtros.dataAte + 'T23:59:59')
    }

    const [total, data] = await Promise.all([
      prisma.chamado.count({ where }),
      prisma.chamado.findMany({
        where,
        skip: (filtros.page - 1) * filtros.limit,
        take: filtros.limit,
        orderBy: { timestamp: 'desc' }
      })
    ])

    return res.json({
      data,
      meta: { total, page: filtros.page, limit: filtros.limit, totalPages: Math.ceil(total / filtros.limit) }
    })
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const chamado = await prisma.chamado.findUnique({ where: { id: req.params.id } })

    if (!chamado || chamado.excluido) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    if (req.userRecord && req.userRecord.nivel !== 'ADMIN') {
      const canAccess =
        req.userRecord.nivel === 'TECNICO' && (chamado.tecnicoSetor === req.userRecord.filial || chamado.responsavel === req.userRecord.nome) ||
        (req.userRecord.nivel === 'GESTOR' || req.userRecord.nivel === 'VISUALIZADOR') && chamado.unidade === req.userRecord.filial

      if (!canAccess) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem acesso a este chamado' })
      }
    }

    return res.json(chamado)
  } catch (err) {
    throw err
  }
})

router.patch('/:id/status', authMiddleware, requireRole('ADMIN', 'TECNICO', 'GESTOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const { status, tecnicoResolucao, descricaoResolucao, responsavel } = AtualizarStatusChamadoSchema.parse(req.body)

    const chamado = await prisma.chamado.findUnique({ where: { id: req.params.id } })
    if (!chamado) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    if (req.userRecord && req.userRecord.nivel !== 'ADMIN') {
      const canUpdate =
        req.userRecord.nivel === 'TECNICO' && (chamado.tecnicoSetor === req.userRecord.filial || chamado.responsavel === req.userRecord.nome) ||
        (req.userRecord.nivel === 'GESTOR') && chamado.unidade === req.userRecord.filial

      if (!canUpdate) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão para alterar este chamado' })
      }
    }

    const agora = new Date()
    const statusAnterior = chamado.status
    const entradaHistorico = `[${agora.toLocaleString('pt-BR')}] Status alterado para "${status}" por ${req.userRecord?.nome || 'Sistema'}${tecnicoResolucao ? ` (técnico: ${tecnicoResolucao})` : ''}${descricaoResolucao ? `\nDescrição da resolução: ${descricaoResolucao}` : ''}`

    const updated = await prisma.chamado.update({
      where: { id: req.params.id },
      data: {
        status,
        responsavel: responsavel || req.userRecord?.nome || chamado.responsavel,
        ultimaAtualizacao: agora,
        tecnicoResolucao: tecnicoResolucao || chamado.tecnicoResolucao,
        descricaoResolucao: descricaoResolucao || chamado.descricaoResolucao,
        historico: `${chamado.historico || ''}\n${entradaHistorico}`.trim()
      }
    })

    if (status !== statusAnterior) {
      await notificarChamadoStatusAlterado(updated)
    }

    return res.json(updated)
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.post('/:id/resposta', authMiddleware, requireRole('ADMIN', 'TECNICO', 'GESTOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const { texto } = ResponderChamadoSchema.parse(req.body)

    const chamado = await prisma.chamado.findUnique({ where: { id: req.params.id } })
    if (!chamado) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    const entrada = `[${new Date().toLocaleString('pt-BR')}] ${req.userRecord?.nome || 'Sistema'}: ${texto}`

    const updated = await prisma.chamado.update({
      where: { id: req.params.id },
      data: {
        responsavel: req.userRecord?.nome,
        ultimaAtualizacao: new Date(),
        historico: `${chamado.historico || ''}\n${entrada}`.trim()
      }
    })

    return res.json(updated)
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.patch('/batch', authMiddleware, requireRole('ADMIN', 'TECNICO'), async (req: AuthenticatedRequest, res) => {
  try {
    const { ids, status, tecnicoResolucao, resposta } = BatchUpdateChamadosSchema.parse(req.body)

    if (req.userRecord && req.userRecord.nivel !== 'ADMIN') {
      const chamados = await prisma.chamado.findMany({ where: { id: { in: ids } } })
      const unauthorized = chamados.some(c =>
        !(c.tecnicoSetor === req.userRecord?.filial || c.responsavel === req.userRecord?.nome)
      )
      if (unauthorized) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão para alterar alguns chamados' })
      }
    }

    const agora = new Date()
    let atualizados = 0

    for (const id of ids) {
      const chamado = await prisma.chamado.findUnique({ where: { id } })
      if (!chamado) continue

      let historicoNovo = chamado.historico || ''

      if (status) {
        const entrada = `[${agora.toLocaleString('pt-BR')}] Status alterado para "${status}" por ${req.userRecord?.nome || 'Sistema'}${tecnicoResolucao ? ` (técnico: ${tecnicoResolucao})` : ''}`
        historicoNovo = `${historicoNovo}\n${entrada}`.trim()
      }

      if (resposta) {
        const entrada = `[${agora.toLocaleString('pt-BR')}] ${req.userRecord?.nome || 'Sistema'}: ${resposta}`
        historicoNovo = `${historicoNovo}\n${entrada}`.trim()
      }

      const updated = await prisma.chamado.update({
        where: { id },
        data: {
          status: status || chamado.status,
          responsavel: req.userRecord?.nome,
          ultimaAtualizacao: agora,
          tecnicoResolucao: tecnicoResolucao || chamado.tecnicoResolucao,
          historico: historicoNovo
        }
      })

      if (status && status !== chamado.status) {
        await notificarChamadoStatusAlterado(updated)
      }

      atualizados++
    }

    return res.json({ atualizados })
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    await prisma.chamado.delete({ where: { id: req.params.id } })
    return res.json({ removido: true })
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.delete('/:id', authMiddleware, requireRole('ADMIN', 'TECNICO', 'GESTOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const chamado = await prisma.chamado.findUnique({ where: { id: req.params.id } })
    if (!chamado) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    if (req.userRecord && req.userRecord.nivel !== 'ADMIN') {
      const canDelete =
        req.userRecord.nivel === 'TECNICO' && (chamado.tecnicoSetor === req.userRecord.filial || chamado.responsavel === req.userRecord.nome) ||
        (req.userRecord.nivel === 'GESTOR') && chamado.unidade === req.userRecord.filial

      if (!canDelete) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão para excluir este chamado' })
      }
    }

    // soft delete: marca como excluído em vez de apagar do banco
    await prisma.chamado.update({
      where: { id: req.params.id },
      data: { excluido: true }
    })
    return res.json({ success: true })
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.delete('/batch', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { ids } = BatchDeleteChamadosSchema.parse(req.body)

    const result = await prisma.chamado.updateMany({ where: { id: { in: ids } }, data: { excluido: true } })

    return res.json({ removidos: result.count })
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

async function gerarProtocolo(): Promise<string> {
  const hoje = new Date()
  const dataStr = hoje.toISOString().slice(0, 10).replace(/-/g, '')
  const count = await prisma.chamado.count({
    where: {
      timestamp: {
        gte: new Date(hoje.setHours(0, 0, 0, 0)),
        lt: new Date(hoje.setHours(23, 59, 59, 999))
      }
    }
  })
  return `CH-${dataStr}-${String(count + 1).padStart(4, '0')}`
}

async function salvarAnexo(base64: string, nome: string, tipo: string, protocolo: string): Promise<string> {
  const safeNome = nome.replace(/[^\w.\-]/g, '_')
  if (!supabase) {
    console.log('[anexo] Supabase Storage não configurado — anexo não persistido.')
    return `anexos/${protocolo}_${safeNome}`
  }

  const filePath = `${protocolo}/${Date.now()}_${safeNome}`
  const bytes = Buffer.from(base64, 'base64')

  try {
    await supabase.storage.from('anexos').upload(filePath, bytes, {
      contentType: tipo || 'application/octet-stream',
      upsert: true
    })
    const { data } = supabase.storage.from('anexos').getPublicUrl(filePath)
    return data.publicUrl
  } catch (err) {
    console.error('[anexo] Falha ao enviar para o Supabase Storage:', err)
    return `anexos/${protocolo}_${safeNome}`
  }
}

async function notificarAltaPrioridade(chamado: any): Promise<void> {
  console.log('Alta prioridade:', chamado.protocolo, chamado.unidade)
}

export default router