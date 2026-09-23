import { Router, Response, Request } from 'express'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest, requireRole, requireFilialAccess } from '../middleware/auth'
import { CriarChamadoSchema, FiltrosChamadoSchema, AtualizarStatusChamadoSchema, ResponderChamadoSchema, BatchUpdateChamadosSchema, BatchDeleteChamadosSchema, ChamadoSchema, PaginatedResponseSchema } from '@shared/api'
import { ZodError } from 'zod'
import { normalizarNomeEscola, getMapaTecnicos } from '../services/normalization'
import { getMapaInventario } from '../services/migration'
import { notificarChamadoStatusAlterado, notificarChamadoCriado } from '../services/email'
import { notificarAdmins, notificarUnidade } from '../services/notificacoes'
import { salvarAnexo, salvarAnexoComPath } from '../services/anexos'

// sempre ignorar chamados marcados como excluídos
const filtroExcluido = { excluido: false }

/** Include padrão: conversa (perguntas/respostas) com anexos ainda válidos. */
const includeMensagens = {
  mensagens: {
    orderBy: { createdAt: 'asc' as const },
    include: { anexos: { where: { expiresAt: { gt: new Date() } } } }
  }
}

/** Anexos de perguntas/respostas são temporários: expiram 7 dias após o envio. */
const DIAS_VALIDADE_ANEXO = 7

/**
 * Formata data/hora sempre no fuso de Brasília. O histórico é gravado como TEXTO
 * e o servidor (Render) roda em UTC — sem o timeZone explícito os horários
 * ficavam deslocados (e misturavam fusos quando gravados por ambientes diferentes).
 */
const fmtHoraLocal = (d: Date): string => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

/**
 * Registra uma mensagem (PERGUNTA da matriz ou RESPOSTA da escola) no chamado,
 * fazendo upload dos anexos temporários para o Storage antes.
 */
async function salvarMensagemComAnexos(
  chamadoId: string,
  protocolo: string,
  tipo: 'PERGUNTA' | 'RESPOSTA',
  autorNome: string,
  texto: string,
  anexos?: Array<{ nome: string; tipo?: string; base64: string }>
) {
  const expiresAt = new Date(Date.now() + DIAS_VALIDADE_ANEXO * 24 * 60 * 60 * 1000)
  const salvos: Array<{ nome: string; tipo: string; url: string; path: string; expiresAt: Date }> = []
  for (const a of anexos ?? []) {
    const salvo = await salvarAnexoComPath(a.base64, a.nome, a.tipo || '', `mensagens/${protocolo}`)
    if (salvo) salvos.push({ nome: a.nome, tipo: a.tipo || '', url: salvo.url, path: salvo.path, expiresAt })
  }
  await prisma.chamadoMensagem.create({
    data: { chamadoId, tipo, autorNome, texto, anexos: { create: salvos } }
  })
}

const router = Router()

/**
 * Casamento tolerante de unidade — necessário porque escolas que dividem o
 * mesmo prédio aparecem compostas ("E.E. A / E.E. B") enquanto os chamados
 * podem trazer só uma delas (ou vice-versa).
 */
function normUnidade(s: string): string {
  let n = String(s || '')
    .toUpperCase()
    .replace(/^E\.?E\.?\s*/i, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  // remove sufixos honoríficos comuns (Prof, Profa, Dr, Presidente...)
  n = n.replace(/(\s+(PROF(A)?|DR(A)?|DEPUTAD[OA]|PRESIDENTE|MAESTRO))+\s*$/, '').trim()
  return n
}

function unidadeCasa(unidade: string | null | undefined, filial: string): boolean {
  if (!unidade || !filial) return false
  if (unidade === filial) return true
  const u = normUnidade(unidade)
  const f = normUnidade(filial)
  if (!u || !f) return false
  if (u.includes(f) || f.includes(u)) return true
  return filial.split('/').some((p) => {
    const pn = normUnidade(p)
    return pn.length > 3 && u.includes(pn)
  })
}

/** Condição Prisma tolerante para filtrar listas por unidade. */
function filtroUnidadeTolerante(filial: string) {
  const partes = [filial, ...filial.split('/')]
    .map((p) => normUnidade(p))
    .filter(Boolean)
  return {
    OR: partes.map((p) => ({ unidade: { contains: p, mode: 'insensitive' as const } })),
  }
}

function getTecnicoSetor(unidade: string): string {
  const mapa = getMapaTecnicos()
  const chave = normalizarNomeEscola(unidade)
  return mapa[chave] || ''
}

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

    const chamado = await prisma.chamado.findUnique({ where: { protocolo }, include: { avaliacao: true } })
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
      ultimaAtualizacao: chamado.ultimaAtualizacao,
      avaliacao: chamado.avaliacao ? { nota: chamado.avaliacao.nota, comentario: chamado.avaliacao.comentario } : null
    })
  } catch (err) {
    throw err
  }
}

/** Público — a escola avalia o atendimento de um chamado concluído (1x por chamado). */
export async function avaliarChamadoPublic(req: Request, res: Response) {
  try {
    const protocolo = String(req.params.protocolo || '').trim()
    const nota = Number(req.body?.nota)
    const comentario = typeof req.body?.comentario === 'string' ? req.body.comentario.trim().slice(0, 1000) : undefined

    if (!protocolo || !Number.isInteger(nota) || nota < 1 || nota > 5) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Informe o protocolo e uma nota de 1 a 5' })
    }

    const chamado = await prisma.chamado.findUnique({ where: { protocolo } })
    if (!chamado || chamado.excluido) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }
    if (chamado.status !== 'RESOLVIDO') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Só é possível avaliar chamados concluídos' })
    }

    const jaAvaliado = await prisma.avaliacao.findUnique({ where: { chamadoId: chamado.id } })
    if (jaAvaliado) {
      return res.status(409).json({ error: 'CONFLICT', message: 'Este chamado já foi avaliado' })
    }

    const avaliacao = await prisma.avaliacao.create({
      data: { chamadoId: chamado.id, nota, comentario: comentario || null }
    })

    return res.status(201).json({ id: avaliacao.id, nota: avaliacao.nota, comentario: avaliacao.comentario })
  } catch (err) {
    throw err
  }
}

export async function criarChamadoPublic(req: Request, res: Response) {
  try {
    const data = CriarChamadoSchema.parse(req.body)

    const tecnicoSetor = getTecnicoSetor(data.unidade)
    const inventarioStatus = await getInventarioStatus(data.unidade)

    // Protocolo é sequencial por dia; duas requisições simultâneas podem gerar o
    // mesmo número e estourar o unique (P2002). Nesse caso regera e tenta de novo.
    let chamado: any = null
    let ultimoErro: any = null
    for (let tentativa = 0; tentativa < 5 && !chamado; tentativa++) {
      const protocolo = await gerarProtocolo()

      let anexoUrl: string | null = null
      if (data.anexoBase64 && data.anexoNome) {
        anexoUrl = await salvarAnexo(data.anexoBase64, data.anexoNome, data.anexoTipo || '', protocolo)
      }

      try {
        chamado = await prisma.chamado.create({
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
            historico: `Chamado criado em ${fmtHoraLocal(new Date())}`
          }
        })
      } catch (err) {
        if ((err as any)?.code === 'P2002') { ultimoErro = err; continue }
        throw err
      }
    }
    if (!chamado) throw ultimoErro

    if (data.urgencia.startsWith('Alta')) {
      await notificarAltaPrioridade(chamado)
    }

    notificarChamadoCriado(chamado).catch(() => {})
    notificarAdmins(
      'CHAMADO_NOVO',
      `Novo chamado ${chamado.protocolo}`,
      `${chamado.unidade} — ${chamado.tipo} (${chamado.urgencia})`,
      '/chamados'
    ).catch(() => {})

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
        Object.assign(where, filtroUnidadeTolerante(req.userRecord.filial))
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
    const chamado = await prisma.chamado.findUnique({ where: { id: req.params.id }, include: includeMensagens })

    if (!chamado || chamado.excluido) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    if (req.userRecord && req.userRecord.nivel !== 'ADMIN') {
      const canAccess =
        req.userRecord.nivel === 'TECNICO' && (chamado.tecnicoSetor === req.userRecord.filial || chamado.responsavel === req.userRecord.nome) ||
        (req.userRecord.nivel === 'GESTOR' || req.userRecord.nivel === 'VISUALIZADOR') && unidadeCasa(chamado.unidade, req.userRecord.filial)

      if (!canAccess) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem acesso a este chamado' })
      }
    }

    return res.json(chamado)
  } catch (err) {
    throw err
  }
})

router.patch('/:id/status', authMiddleware, requireRole('ADMIN', 'TECNICO', 'GESTOR', 'VISUALIZADOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const { status, tecnicoResolucao, descricaoResolucao, responsavel, pergunta, perguntaAnexos } = AtualizarStatusChamadoSchema.parse(req.body)

    const chamado = await prisma.chamado.findUnique({ where: { id: req.params.id } })
    if (!chamado) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    if (req.userRecord && req.userRecord.nivel !== 'ADMIN') {
      const canUpdate =
        req.userRecord.nivel === 'TECNICO' && (chamado.tecnicoSetor === req.userRecord.filial || chamado.responsavel === req.userRecord.nome) ||
        ['GESTOR','VISUALIZADOR'].includes(req.userRecord.nivel) && unidadeCasa(chamado.unidade, req.userRecord.filial)

      if (!canUpdate) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão para alterar este chamado' })
      }
    }

    // Escola (gestor/visualizador) só pode alterar o chamado para Concluído
    if (['GESTOR', 'VISUALIZADOR'].includes(req.userRecord?.nivel || '') && status !== 'RESOLVIDO') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'A escola só pode alterar o chamado para Concluído' })
    }

    const agora = new Date()
    const statusAnterior = chamado.status
    const entradaHistorico = `[${fmtHoraLocal(agora)}] Status alterado para "${status}" por ${req.userRecord?.nome || 'Sistema'}${tecnicoResolucao ? ` (técnico: ${tecnicoResolucao})` : ''}${descricaoResolucao ? `\nDescrição da resolução: ${descricaoResolucao}` : ''}${status === 'COMUNICADO' && pergunta?.trim() ? `\nPergunta para a escola: ${pergunta.trim()}` : ''}`

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

    // Matriz colocou em "Aguardando escola" com uma pergunta: registra na conversa (múltiplas rodadas)
    if (status === 'COMUNICADO' && pergunta?.trim()) {
      await salvarMensagemComAnexos(chamado.id, chamado.protocolo, 'PERGUNTA', req.userRecord?.nome || 'Matriz', pergunta.trim(), perguntaAnexos)
    }

    if (status !== statusAnterior) {
      await notificarChamadoStatusAlterado(updated)
    }

    // Notifica a unidade da escola (gestor/visualizador veem no sino do portal).
    // COMUNICADO com pergunta notifica mesmo sem mudança de status (nova rodada de perguntas).
    if (status === 'COMUNICADO' && (status !== statusAnterior || pergunta?.trim())) {
      notificarUnidade(chamado.unidade, 'CHAMADO_RESPONDIDO', `Chamado ${chamado.protocolo} respondido`, pergunta?.trim() || 'A equipe respondeu e aguarda retorno da escola.', `/chamados/${chamado.id}`).catch(() => {})
    } else if (status === 'RESOLVIDO' && status !== statusAnterior) {
      notificarUnidade(chamado.unidade, 'CHAMADO_FINALIZADO', `Chamado ${chamado.protocolo} concluído`, chamado.descricaoResolucao || 'O chamado foi concluído pela equipe.', `/chamados/${chamado.id}`).catch(() => {})
    }

    const completo = await prisma.chamado.findUnique({ where: { id: updated.id }, include: includeMensagens })
    return res.json(completo ?? updated)
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.post('/:id/resposta', authMiddleware, requireRole('ADMIN', 'TECNICO', 'GESTOR', 'VISUALIZADOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const { texto, anexos } = ResponderChamadoSchema.parse(req.body)

    const chamado = await prisma.chamado.findUnique({ where: { id: req.params.id } })
    if (!chamado) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    if (req.userRecord && req.userRecord.nivel !== 'ADMIN') {
      const canAccess =
        req.userRecord.nivel === 'TECNICO' && (chamado.tecnicoSetor === req.userRecord.filial || chamado.responsavel === req.userRecord.nome) ||
        (req.userRecord.nivel === 'GESTOR' || req.userRecord.nivel === 'VISUALIZADOR') && unidadeCasa(chamado.unidade, req.userRecord.filial)

      if (!canAccess) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem acesso a este chamado' })
      }
    }

    const autor = req.userRecord?.nome || 'Sistema'
    const ehEscola = ['GESTOR', 'VISUALIZADOR'].includes(req.userRecord?.nivel || '')
    // Escola respondendo um chamado "Aguardando escola": a bola volta para a matriz
    const voltaParaMatriz = ehEscola && chamado.status === 'COMUNICADO'
    const agora = new Date()

    const entrada = `[${fmtHoraLocal(agora)}] ${autor}: ${texto}`
    const entradaStatus = voltaParaMatriz
      ? `\n[${fmtHoraLocal(agora)}] Status alterado para "ANDAMENTO" por ${autor} (resposta da escola)`
      : ''

    const updated = await prisma.chamado.update({
      where: { id: req.params.id },
      data: {
        responsavel: req.userRecord?.nome,
        status: voltaParaMatriz ? 'ANDAMENTO' : chamado.status,
        ultimaAtualizacao: agora,
        historico: `${chamado.historico || ''}\n${entrada}${entradaStatus}`.trim()
      }
    })

    // Respostas da escola entram na conversa (com anexos temporários); respostas da matriz
    // só viram mensagem quando carregam anexo (notas internas continuam apenas no histórico).
    if (ehEscola || (anexos?.length ?? 0) > 0) {
      await salvarMensagemComAnexos(chamado.id, chamado.protocolo, ehEscola ? 'RESPOSTA' : 'PERGUNTA', autor, texto, anexos)
    }

    if (voltaParaMatriz) {
      notificarAdmins('CHAMADO_RESPONDIDO', `Escola respondeu o chamado ${chamado.protocolo}`, `${autor} respondeu à pergunta da equipe. O chamado voltou para "Em atendimento".`, `/chamados/${chamado.id}`).catch(() => {})
    }

    const completo = await prisma.chamado.findUnique({ where: { id: updated.id }, include: includeMensagens })
    return res.json(completo ?? updated)
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
        const entrada = `[${fmtHoraLocal(agora)}] Status alterado para "${status}" por ${req.userRecord?.nome || 'Sistema'}${tecnicoResolucao ? ` (técnico: ${tecnicoResolucao})` : ''}`
        historicoNovo = `${historicoNovo}\n${entrada}`.trim()
      }

      if (resposta) {
        const entrada = `[${fmtHoraLocal(agora)}] ${req.userRecord?.nome || 'Sistema'}: ${resposta}`
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

router.delete('/:id', authMiddleware, requireRole('ADMIN', 'TECNICO', 'GESTOR', 'VISUALIZADOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const chamado = await prisma.chamado.findUnique({ where: { id: req.params.id } })
    if (!chamado) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    if (req.userRecord && req.userRecord.nivel !== 'ADMIN') {
      const canDelete =
        req.userRecord.nivel === 'TECNICO' && (chamado.tecnicoSetor === req.userRecord.filial || chamado.responsavel === req.userRecord.nome) ||
        ['GESTOR','VISUALIZADOR'].includes(req.userRecord.nivel) && chamado.unidade === req.userRecord.filial

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
  const dataStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefixo = `CH-${dataStr}-`
  // pega o último protocolo do dia (não count): resistente a exclusões manuais
  const ultimo = await prisma.chamado.findFirst({
    where: { protocolo: { startsWith: prefixo } },
    orderBy: { protocolo: 'desc' },
    select: { protocolo: true }
  })
  const seq = ultimo ? parseInt(ultimo.protocolo.slice(prefixo.length), 10) + 1 : 1
  return `${prefixo}${String(seq).padStart(4, '0')}`
}

async function notificarAltaPrioridade(chamado: any): Promise<void> {
  console.log('Alta prioridade:', chamado.protocolo, chamado.unidade)
}

export default router