import { Router, Response, Request } from 'express'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest, requireRole, requireFilialAccess } from '../middleware/auth'
import { CriarChamadoSchema, FiltrosChamadoSchema, AtualizarStatusChamadoSchema, ResponderChamadoSchema, BatchUpdateChamadosSchema, BatchDeleteChamadosSchema, EncaminharChamadoSchema, ChamadoSchema, PaginatedResponseSchema, ConsultarChamadoPublicoSchema } from '@shared/api'
import { ZodError } from 'zod'
import { normalizarNomeEscola, getMapaTecnicos } from '../services/normalization'
import { getMapaInventario } from '../services/migration'
import { notificarChamadoStatusAlterado, notificarChamadoCriado } from '../services/email'
import { notificarAdmins, notificarUnidade } from '../services/notificacoes'
import { encaminharChamado, encaminharPorRegras, tecnicosDaUnidade, destinoWhere } from '../services/encaminhamento'
import { filtroUnidadesDoUsuario, usuarioAtendeUnidade } from '../services/unidades'
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

/**
 * O técnico "é dono" deste chamado?
 *
 * - É o responsável (encaminhamento automático ou manual) OU
 * - atende a unidade do chamado — o técnico pode ter VÁRIAS unidades no `filial`
 *   (separadas por vírgula), então a comparação precisa ser lista a lista.
 *
 * Substitui a comparação antiga `tecnicoSetor === user.filial`, que quebrava
 * assim que o técnico passou a atender mais de uma escola.
 */
function tecnicoAtende(
  chamado: { unidade: string; responsavel: string | null },
  user: AuthenticatedRequest['userRecord'],
): boolean {
  if (!user || user.nivel !== 'TECNICO') return false
  if (chamado.responsavel && chamado.responsavel === user.nome) return true
  return usuarioAtendeUnidade(user.filial, chamado.unidade)
}

async function getInventarioStatus(unidade: string): Promise<string | null> {
  const mapa = await getMapaInventario()
  const chave = normalizarNomeEscola(unidade)
  return mapa[chave] || null
}

/**
 * Resposta ÚNICA para "protocolo inexistente", "chamado sem e-mail" e "e-mail
 * diferente do cadastrado". Mensagens distintas permitiriam enumerar protocolos
 * válidos (são sequenciais por dia) testando e-mails a partir de um throughput.
 */
const NAO_ENCONTRADO_PUBLICO = { error: 'NOT_FOUND', message: 'Chamado não encontrado. Confira o protocolo e o e-mail informados.' }

/** E-mail do chamado casa com o informado? Comparação sem caixa/espaços nas pontas. */
function emailConfere(emailDoChamado: string | null | undefined, emailInformado: string): boolean {
  if (!emailDoChamado) return false
  return emailDoChamado.trim().toLowerCase() === emailInformado.trim().toLowerCase()
}

/**
 * Credenciais públicas (protocolo + e-mail) vindas de params/query/body.
 * O e-mail pode ir na query (GET) ou no corpo (POST): ambos são aceitos para
 * o par ser o mesmo nas duas rotas. Devolve `null` quando falta ou é inválido —
 * a resposta 400 é uniforme e não revela se o protocolo existe.
 */
function credenciaisPublicas(req: Request): { protocolo: string; email: string } | null {
  const r = ConsultarChamadoPublicoSchema.safeParse({
    protocolo: String(req.params.protocolo ?? ''),
    email: String(req.query.email ?? req.body?.email ?? ''),
  })
  return r.success ? r.data : null
}

export async function consultarChamadoPublic(req: Request, res: Response) {
  try {
    const credenciais = credenciaisPublicas(req)
    if (!credenciais) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Informe o protocolo e o e-mail usado na abertura do chamado' })
    }
    const { protocolo, email } = credenciais

    const chamado = await prisma.chamado.findUnique({
      where: { protocolo },
      include: {
        avaliacao: true,
        // Conversa matriz ↔ unidade (perguntas "Aguardando resposta" e respostas),
        // visível na consulta pública de protocolo
        mensagens: {
          orderBy: { createdAt: 'asc' },
          include: { anexos: { select: { nome: true, tipo: true, url: true, expiresAt: true } } }
        }
      }
    })
    // Chamado legado (sem e-mail gravado) também fica inacessível: o e-mail é
    // a credencial do solicitante, não há como provar a titularidade sem ele.
    // A mensagem é a mesma nos 4 casos de 404 (inexistente, excluído, e-mail
    // errado, sem e-mail gravado) para não permitir enumerar protocolos válidos.
    if (!chamado || chamado.excluido || !emailConfere(chamado.email, email)) {
      return res.status(404).json(NAO_ENCONTRADO_PUBLICO)
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
      avaliacao: chamado.avaliacao ? { nota: chamado.avaliacao.nota, comentario: chamado.avaliacao.comentario } : null,
      mensagens: chamado.mensagens.map((m) => ({
        id: m.id,
        tipo: m.tipo, // PERGUNTA (matriz) | RESPOSTA (unidade)
        autorNome: m.autorNome,
        texto: m.texto,
        createdAt: m.createdAt,
        anexos: m.anexos
      }))
    })
  } catch (err) {
    // Handler público é montado direto no index.ts (sem `next`), e no Express 4
    // `throw` num async vira unhandled rejection: o processo continua vivo
    // (ver o unhandledRejection em index.ts) mas a requisição fica pendurada
    // até o cliente desistir. Responder 500 é melhor do que não responder.
    console.error('[consultarChamadoPublic]', err)
    if (!res.headersSent) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Não foi possível consultar o chamado agora. Tente novamente.' })
    }
    return
  }
}

/** Público — a escola avalia o atendimento de um chamado concluído (1x por chamado). */
export async function avaliarChamadoPublic(req: Request, res: Response) {
  try {
    const credenciais = credenciaisPublicas(req)
    const nota = Number(req.body?.nota)
    const comentario = typeof req.body?.comentario === 'string' ? req.body.comentario.trim().slice(0, 1000) : undefined

    if (!credenciais || !Number.isInteger(nota) || nota < 1 || nota > 5) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Informe o protocolo, o e-mail usado na abertura do chamado e uma nota de 1 a 5' })
    }
    const { protocolo, email } = credenciais

    const chamado = await prisma.chamado.findUnique({ where: { protocolo } })
    // Mesma trava da consulta: só quem abriu o chamado (protocolo + e-mail) avalia.
    if (!chamado || chamado.excluido || !emailConfere(chamado.email, email)) {
      return res.status(404).json(NAO_ENCONTRADO_PUBLICO)
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
    // Mesmo motivo da consulta: responder 500 em vez de deixar a requisição
    // pendurada (Express 4 não captura rejeição de handler async).
    console.error('[avaliarChamadoPublic]', err)
    if (!res.headersSent) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Não foi possível registrar a avaliação agora. Tente novamente.' })
    }
    return
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
            categoriaChave: data.categoriaChave || null,
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

    // Encaminhamento automático: chamado de uma categoria com regra ativa
    // (ex.: equipamento) já nasce com o técnico da unidade como responsável.
    // Falha aqui não pode impedir a criação do chamado.
    try {
      await encaminharPorRegras(chamado)
    } catch {
      /* silencioso: o chamado foi criado e os admins seguem notificados abaixo */
    }

    notificarChamadoCriado(chamado).catch(() => {})
    notificarAdmins(
      'CHAMADO_NOVO',
      `Novo chamado ${chamado.protocolo}`,
      `${chamado.unidade} — ${chamado.tipo} (${chamado.urgencia})`,
      `/chamados/${chamado.id}`
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
        // Técnico: chamados que ele atende (lista de unidades) OU que são dele
        where.OR = [
          ...filtroUnidadesDoUsuario(req.userRecord.filial).OR,
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

/**
 * Destinos ativos para o seletor de encaminhamento do modal de detalhes:
 * ADMIN e TECNICO (ver `NIVEIS_DESTINO`). Fica ANTES de `/:id` para não ser
 * capturada pela rota de chamado por id.
 */
router.get('/encaminhar/tecnicos', authMiddleware, requireRole('ADMIN', 'TECNICO'), async (_req: AuthenticatedRequest, res) => {
  try {
    const tecnicos = await prisma.usuario.findMany({
      where: destinoWhere,
      select: { id: true, nome: true, email: true, filial: true },
      orderBy: { nome: 'asc' },
    })
    return res.json({ data: tecnicos })
  } catch (err) {
    throw err
  }
})

/** Técnicos que atendem a unidade do chamado (sugestão do "Técnico da unidade"). */
router.get('/encaminhar/tecnicos/:id', authMiddleware, requireRole('ADMIN', 'TECNICO'), async (req: AuthenticatedRequest, res) => {
  try {
    const chamado = await prisma.chamado.findUnique({ where: { id: req.params.id }, select: { unidade: true } })
    if (!chamado) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }
    const tecnicos = await tecnicosDaUnidade(chamado.unidade)
    return res.json({ data: tecnicos })
  } catch (err) {
    throw err
  }
})

/**
 * Encaminha/reencaminha o chamado para um técnico (modal de detalhes).
 *
 * Usado quando a escola abriu o chamado na categoria errada e ele precisa
 * mesmo assim chegar ao técnico. Sobrescreve o responsável anterior e deixa
 * o registro no histórico.
 */
router.post('/:id/encaminhar', authMiddleware, requireRole('ADMIN', 'TECNICO'), async (req: AuthenticatedRequest, res) => {
  try {
    const { modo, tecnicoId, observacao } = EncaminharChamadoSchema.parse(req.body)

    const chamado = await prisma.chamado.findUnique({ where: { id: req.params.id } })
    if (!chamado || chamado.excluido) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    // Técnico só encaminha chamado que ele atende; a matriz vê todos.
    if (req.userRecord?.nivel === 'TECNICO' && !tecnicoAtende(chamado, req.userRecord)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem acesso a este chamado' })
    }

    const resultado = await encaminharChamado(chamado, {
      modo,
      tecnicoId,
      observacao,
      origem: 'Manual',
      autor: req.userRecord?.nome,
    })

    if (!resultado.ok) {
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: resultado.motivo || 'Não foi possível encaminhar o chamado.',
      })
    }

    const completo = await prisma.chamado.findUnique({ where: { id: chamado.id }, include: includeMensagens })
    return res.json({ chamado: completo, tecnico: resultado.tecnico })
  } catch (err) {
    // `instanceof` falha entre as duas cópias do zod (o @shared/api tem a sua):
    // confere também o nome da classe, senão o Express 4 não responde (timeout).
    if (err instanceof ZodError || (err as any)?.name === 'ZodError') {
      const z = err as ZodError
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: z.flatten().fieldErrors })
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
        tecnicoAtende(chamado, req.userRecord) ||
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
        tecnicoAtende(chamado, req.userRecord) ||
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
      notificarUnidade(chamado.unidade, 'CHAMADO_RESPONDIDO', `Chamado ${chamado.protocolo} respondido`, pergunta?.trim() || 'A equipe respondeu e aguarda o retorno do solicitante.', `/chamados/${chamado.id}`).catch(() => {})
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
        tecnicoAtende(chamado, req.userRecord) ||
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
      const unauthorized = chamados.some(c => !tecnicoAtende(c, req.userRecord))
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

// Precisa ficar DEPOIS de '/batch' — senão captura 'batch' como :id
router.delete('/:id', authMiddleware, requireRole('ADMIN', 'TECNICO', 'GESTOR', 'VISUALIZADOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const chamado = await prisma.chamado.findUnique({ where: { id: req.params.id } })
    if (!chamado) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    if (req.userRecord && req.userRecord.nivel !== 'ADMIN') {
      const canDelete =
        tecnicoAtende(chamado, req.userRecord) ||
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