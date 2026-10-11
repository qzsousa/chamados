import { Router, Response, Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest, requireRole, requireFilialAccess } from '../middleware/auth'
import { CriarChamadoSchema, FiltrosChamadoSchema, AtualizarStatusChamadoSchema, ResponderChamadoSchema, BatchUpdateChamadosSchema, BatchDeleteChamadosSchema, EncaminharChamadoSchema, ChamadoSchema, PaginatedResponseSchema, ConsultarChamadoPublicoSchema, CATEGORIA_SEM_CHAVE, RegistrarAtividadeSchema, ConcluirChamadoSchema, ConferirChamadoSchema, TipoAtividadeSchema } from '@shared/api'
import { ZodError } from 'zod'
import { isZodError, respostaValidacao } from '../utils/zodError'
import { normalizarNomeEscola, getMapaTecnicos } from '../services/normalization'
import { getMapaInventario } from '../services/migration'
import { notificarChamadoStatusAlterado, notificarChamadoCriado } from '../services/email'
import { notificarAdmins, notificarUnidade, notificarTecnicoResponsavel } from '../services/notificacoes'
import { encaminharChamado, encaminharPorRegras, tecnicosDaUnidade, destinoWhere } from '../services/encaminhamento'
import { filtroUnidadesDoUsuario, usuarioAtendeUnidade } from '../services/unidades'
import { casaComEscopo, clauseDeEscopo, temEscopo } from '../services/escopo'
import { salvarAnexo, salvarAnexoComPath } from '../services/anexos'
import {
  avaliarRespostasFormulario,
  carregarCategoriaFormulario,
  RespostaAceita,
  RespostaFormulario
} from './formulario'

// sempre ignorar chamados marcados como excluídos
const filtroExcluido = { excluido: false }

// ============================================
// CONTRATO DO FORMULÁRIO NA ABERTURA DO CHAMADO
// ============================================
//
// `CriarChamadoSchema` (em @shared/api) continua sendo a porta de entrada do
// resto do payload — unidade, solicitante, e-mail, `categoriaChave` e o
// `anexoBase64` único do formulário antigo. Aqui embaixo entram DUAS coisas que
// o formulário dinâmico passou a exigir e que ainda não tinham lugar no schema:
//
//   respostas: [{ perguntaId, resposta }]  — o que a escola respondeu
//   anexos:     [{ nome, tipo, base64 }]    — VÁRIOS arquivos de uma vez
//
// Ficam no arquivo em vez de irem para @shared/api porque o contrato é do
// endpoint e o arquivo já é o dono dele; quando outro repositório precisar
// tipar o payload, o certo é mover este bloco para shared/types/api.ts.

/** Limite por arquivo e por pedido — os mesmos da conversa (5 arquivos, 5MB). */
const MAX_ANEXOS_FORMULARIO = 5
const TAMANHO_MAX_ANEXO_FORMULARIO = 5 * 1024 * 1024

type AnexoFormulario = {
  nome: string
  tipo?: string
  base64: string
}

/**
 * Lê `anexos` do corpo sem estourar em payload quebrado.
 *
 * Devolve lista de problema em vez de lançar: quem chama decide o status, e
 * `criarChamadoPublic` precisa continuar devolvendo 400 (e não 500) para corpo
 * inválido. Um `anexos: "texto"` no lugar da lista é erro do cliente, não
 * motivo para derrubar o processo.
 *
 * Todo item ruim é FATAL: quem mandou arquivo sem nome/base64 ou grande demais
 * está esperando que ele esteja no chamado — deixar passar em silêncio faria o
 * técnico receber um chamado "sem anexo" e a escola acreditar que anexou.
 */
function lerAnexosFormulario(bruto: unknown): { anexos: AnexoFormulario[]; problemas: string[] } {
  const problemas: string[] = []

  // Tolerância: um portal mandando UM objeto em vez da lista ainda funciona. (O
  // `anexoBase64` do formulário antigo NÃO vem aqui — vem no topo do corpo e é
  // costurado na lista mais abaixo.)
  if (bruto && typeof bruto === 'object' && !Array.isArray(bruto)) {
    const o = bruto as Record<string, unknown>
    const base64 = typeof o.base64 === 'string' ? o.base64.trim() : ''
    const nome = typeof o.nome === 'string' ? o.nome.trim() : ''
    if (!base64 || !nome) return { anexos: [], problemas }
    return {
      anexos: [{ nome, tipo: typeof o.tipo === 'string' ? o.tipo : undefined, base64 }],
      problemas
    }
  }

  if (bruto === undefined || bruto === null) return { anexos: [], problemas }
  if (!Array.isArray(bruto)) {
    problemas.push('anexos deve ser uma lista de arquivos')
    return { anexos: [], problemas }
  }
  if (bruto.length > MAX_ANEXOS_FORMULARIO) {
    problemas.push(`envie no máximo ${MAX_ANEXOS_FORMULARIO} arquivos por chamado`)
    return { anexos: [], problemas }
  }

  const anexos: AnexoFormulario[] = []
  for (const [i, item] of bruto.entries()) {
    const o = (item ?? {}) as Record<string, unknown>
    const nome = typeof o.nome === 'string' ? o.nome.trim() : ''
    const base64 = typeof o.base64 === 'string' ? o.base64.trim() : ''
    if (!nome || !base64) {
      problemas.push(`anexos[${i}] precisa de "nome" e "base64"`)
      continue
    }
    // base64 codifica 3 bytes em 4 chars — o tamanho real é ~ length * 3/4.
    if ((base64.length * 3) / 4 > TAMANHO_MAX_ANEXO_FORMULARIO) {
      problemas.push(`anexos[${i}] maior que 5MB`)
      continue
    }
    anexos.push({ nome, tipo: typeof o.tipo === 'string' ? o.tipo : undefined, base64 })
  }
  return { anexos, problemas }
}

/**
 * Lê `respostas` do corpo. Diferente do anexo, item malformado aqui é DESCARTADO
 * e não vira 400: uma resposta fora de ordem não tem por que impedir a escola de
 * registrar o problema — e `avaliarRespostasFormulario` já valida o que importa
 * (a resposta precisa ser de uma pergunta visível e, em `OPCOES`, ser uma opção
 * de verdade).
 *
 * O que NÃO é tolerado é a forma do payload: `respostas` fora de lista é erro de
 * cliente e volta 400.
 */
function lerRespostasFormulario(bruto: unknown): { respostas: RespostaFormulario[]; problema?: string } {
  if (bruto === undefined || bruto === null) return { respostas: [] }
  if (!Array.isArray(bruto)) return { respostas: [], problema: 'respostas deve ser uma lista' }
  // Teto folgado: nenhuma categoria do formulário chega perto disso, e o limite
  // existe para segurar corpo gigante sem precisar carregar o formulário inteiro.
  if (bruto.length > 100) {
    return { respostas: [], problema: 'respostas tem mais itens que o formulário tem perguntas' }
  }

  const respostas: RespostaFormulario[] = []
  for (const item of bruto) {
    const o = (item ?? {}) as Record<string, unknown>
    if (typeof o.perguntaId === 'string' && o.perguntaId && typeof o.resposta === 'string') {
      respostas.push({ perguntaId: o.perguntaId, resposta: o.resposta })
    }
  }
  return { respostas }
}

/**
 * O que faz um chamado "pertencer" a uma categoria do formulário.
 *
 * São DOIS caminhos porque a maioria do histórico foi aberta antes do
 * formulário ficar dinâmico e veio sem `categoriaChave` gravada — no banco,
 * 364 dos 366 chamados. Para esses o único vestígio é o `tipo`, que o backend
 * monta como `"<Nome da categoria> - <primeira resposta>"`, daí o `startsWith`
 * pelo nome ATUAL da categoria (se o ADMIN renomear a categoria, passa a valer
 * o nome novo).
 *
 * Fica aqui, e não repetido em cada filtro, para o filtro por categoria e o
 * "sem categoria" (`__sem__`) nunca discordarem do que é uma categoria.
 */
function clauseDaCategoria(categoria: { chave: string; nome?: string }): Record<string, unknown> {
  return {
    OR: [
      { categoriaChave: { equals: categoria.chave, mode: 'insensitive' } },
      ...(categoria.nome
        ? [{ tipo: { startsWith: categoria.nome, mode: 'insensitive' } }]
        : []),
    ],
  }
}

/**
 * O NEGATIVO de `clauseDaCategoria` — o que o filtro "Sem categoria" procura.
 *
 * ⚠️ Três armadilhas do Prisma nesta negation, todas já testadas contra o banco
 * real (o filtro saía vazio ou contava o mesmo chamado duas vezes):
 *
 * 1. `{ NOT: clauseDaCategoria(c) }` não funciona: `categoriaChave` é NULL nos
 *    chamados antigos (364 de 366) e em SQL `NOT (NULL = 'rede' OR false)`
 *    vale NULL, não true — o banco descarta a linha.
 * 2. `{ categoriaChave: { not: chave } }` sozinho também não funciona, pelo
 *    mesmo motivo (NULL no `not`).
 * 3. `{ tipo: { not: /regex/i } }` é aceito e **não filtra nada** nesta versão
 *    do Prisma; `notStartsWith` nem existe. Por isso o `NOT` do `tipo` é
 *    colocado no objeto inteiro, e não dentro do campo.
 *
 * O `tipo` é NOT NULL no schema, então o `NOT` sobre ele é um booleano de
 * verdade — diferente da chave, que precisa do `IS NULL` à mão.
 */
function clausesForaDeTodas(ativas: Array<{ chave: string; nome: string }>): Record<string, unknown>[] {
  return ativas.flatMap((c) => [
    { OR: [{ categoriaChave: null }, { categoriaChave: { not: c.chave } }] },
    { NOT: { tipo: { startsWith: c.nome, mode: 'insensitive' } } },
  ])
}

/** Include padrão: conversa (perguntas/respostas) com anexos ainda válidos. */
const includeMensagens = {
  mensagens: {
    orderBy: { createdAt: 'asc' as const },
    include: { anexos: { where: { expiresAt: { gt: new Date() } } } }
  }
}

/**
 * Registros datados do atendimento — o que o técnico fez, a conclusão, a
 * contestação e a aprovação. Anexos **não** são filtrados por expiração: este
 * arquivo é a prova do serviço e precisa continuar acessível.
 */
const includeAtividades = {
  atividades: {
    orderBy: { criadoEm: 'asc' as const },
    include: { anexos: { select: { id: true, nome: true, tipo: true, url: true } } }
  }
}

/**
 * Anexos enviados na abertura, pelo formulário. Não expiram: são parte da
 * descrição do problema, então entram no detalhe junto com a conversa.
 */
const includeAnexosAbertura = {
  anexos: { select: { id: true, nome: true, tipo: true, url: true, criadoEm: true } }
}

/** Detalhe completo do chamado: anexos da abertura + conversa + registros de atendimento. */
const includeDetalhe = { ...includeAnexosAbertura, ...includeMensagens, ...includeAtividades }

/** Anexos de perguntas/respostas são temporários: expiram 7 dias após o envio. */
const DIAS_VALIDADE_ANEXO = 7

/**
 * Status em que o técnico JÁ assumiu o chamado no ciclo atual — é o que libera
 * registrar atividade e concluir.
 *
 * Não olha `aceitoEm` porque ele é acumulado entre ciclos: depois de uma
 * contestação o status volta para ABERTO com o `aceitoEm` antigo ainda gravado,
 * e o técnico não pode registrar nada antes de aceitar de novo.
 */
const STATUS_COM_TECNICO_ACEITO = ['ANDAMENTO', 'COMUNICADO', 'AGUARDANDO_CONFERENCIA']

/** Status em que o técnico ainda precisa assumir o chamado. */
const STATUS_Aguardando_ACEITE = ['ABERTO', 'ENCAMINHADO']

/**
 * Grava um registro datado na linha do tempo do chamado, fazendo upload dos
 * anexos antes. `criadoEm` é o relógio do servidor — é esse campo que a tela
 * mostra, nada é inferido do texto do histórico.
 */
async function salvarAtividade(
  chamadoId: string,
  protocolo: string,
  tipo: (typeof TipoAtividadeSchema)['_output'],
  autorNome: string,
  autorNivel: string | null | undefined,
  texto: string,
  anexos?: Array<{ nome: string; tipo?: string; base64: string }>
) {
  const salvos: Array<{ nome: string; tipo: string; url: string }> = []
  for (const a of anexos ?? []) {
    const salvo = await salvarAnexoComPath(a.base64, a.nome, a.tipo || '', `atividades/${protocolo}`)
    if (salvo) salvos.push({ nome: a.nome, tipo: a.tipo || '', url: salvo.url })
  }
  return prisma.chamadoAtividade.create({
    data: { chamadoId, tipo, autorNome, autorNivel: autorNivel ?? null, texto, anexos: { create: salvos } },
    include: { anexos: { select: { id: true, nome: true, tipo: true, url: true } } },
  })
}

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
 *
 * ESCOPO DE TIPOS: usuário com `escopoTipos` preenchido atende os chamados
 * destes tipos, de QUALQUER escola — a trava de unidade não vale para ele. Sem
 * escopo, a regra é a de sempre, só por unidade. Ver `services/escopo.ts`.
 *
 * É `async` por causa dessa segunda consulta; quem chama em laço deve usar
 * `filtrarPorEscopo`, que resolve os nomes das categorias uma vez só.
 */
async function tecnicoAtende(
  chamado: { unidade: string; responsavel: string | null; tipo?: string | null; categoriaChave?: string | null },
  user: AuthenticatedRequest['userRecord'],
): Promise<boolean> {
  if (!user || user.nivel !== 'TECNICO') return false
  if (temEscopo(user)) return casaComEscopo(chamado, user)
  if (chamado.responsavel && chamado.responsavel === user.nome) return true
  return usuarioAtendeUnidade(user.filial, chamado.unidade)
}

/**
 * O usuário logado é o DONO deste chamado — quem pode aceitar, registrar o que
 * fez e concluir.
 *
 * Diferente de `tecnicoAtende` (que responde "esse técnico atende essa
 * escola?", e libera até o colega de plantão a ver o chamado), aqui a pergunta
 * é "esse chamado é seu?": aceitar o serviço de alguém é assumir a
 * responsabilidade por ele, então só o responsável gravado pode.
 *
 * ADMIN responde por todos — é o nível que atende chamado sem dono.
 */
function ehDonoDoChamado(
  chamado: { responsavelId?: string | null; responsavel?: string | null },
  user: AuthenticatedRequest['userRecord'],
): boolean {
  if (!user) return false
  if (user.nivel === 'ADMIN') return true
  if (user.nivel !== 'TECNICO') return false
  if (chamado.responsavelId) return chamado.responsavelId === user.id
  return !!chamado.responsavel && chamado.responsavel === user.nome
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
        // Arquivos enviados na abertura (formulário). São permanentes: o
        // solicitante precisa conferir o que mandou junto com o relato.
        anexos: { select: { nome: true, tipo: true, url: true } },
        // Conversa matriz ↔ unidade (perguntas "Aguardando resposta" e respostas),
        // visível na consulta pública de protocolo
        mensagens: {
          orderBy: { createdAt: 'asc' },
          include: { anexos: { select: { nome: true, tipo: true, url: true, expiresAt: true } } }
        },
        // O que a equipe registrou no atendimento, na ordem em que foi feito
        atividades: {
          orderBy: { criadoEm: 'asc' },
          include: { anexos: { select: { nome: true, tipo: true, url: true } } }
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
      reaberturas: chamado.reaberturas,
      anexoUrl: chamado.anexoUrl,
      // O que a escola respondeu no formulário dinâmico e os arquivos que mandou
      // na abertura. NULL/vazio nos chamados sem formulário — todo o histórico.
      formularioRespostas: chamado.formularioRespostas ?? [],
      anexos: chamado.anexos,
      timestamp: chamado.timestamp,
      ultimaAtualizacao: chamado.ultimaAtualizacao,
      avaliacao: chamado.avaliacao ? { nota: chamado.avaliacao.nota, comentario: chamado.avaliacao.comentario } : null,
      // O solicitante tem direito de ler o que fizeram no equipamento dele:
      // são os registros de atendimento, com horário real e comprovante.
      atividades: chamado.atividades.map((a) => ({
        id: a.id,
        tipo: a.tipo,
        autorNome: a.autorNome,
        texto: a.texto,
        criadoEm: a.criadoEm,
        anexos: a.anexos
      })),
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

/**
 * Aplica as condições do formulário ao payload de abertura.
 *
 * ⚠️ Só roda quando o portal MANDOU `respostas`. Sem essa trava, todo cliente
 * antigo (que manda só `categoriaChave`, das versões anteriores do formulário)
 * passaria a receber 400 por "pergunta obrigatória faltando" — as condições do
 * formulário virariam uma mudança quebrada em vez de uma validação a mais.
 * Cliente que não manda respostas tem o contrato antigo garantido.
 *
 * Devolve `bloqueio: null` + as respostas aceitas quando o payload passou; nos
 * demais casos a resposta HTTP já está pronta e o chamador só a devolve.
 */
async function validarFormularioDaAbertura(
  categoriaChave: string | undefined,
  respostas: RespostaFormulario[],
  quantidadeAnexos: number
): Promise<{
  bloqueio: { status: number; corpo: unknown } | null
  aceitas: RespostaAceita[]
}> {
  const semValidacao = { bloqueio: null, aceitas: [] as RespostaAceita[] }
  if (!categoriaChave || respostas.length === 0) return semValidacao

  // Categoria inexistente/desativada não invalida nada: é o caso de qualquer
  // portal desatualizado e de todo o histórico, e sem as perguntas não há
  // condição possível de checar.
  const categoria = await carregarCategoriaFormulario(categoriaChave)
  if (!categoria) return semValidacao

  const avaliacao = avaliarRespostasFormulario(categoria, respostas, quantidadeAnexos)

  // "A escola está sem energia, aguarde voltarem": a resposta está CORRETA e
  // mesmo assim o chamado não deve existir. 422 (não 400) porque o corpo é
  // válido — é o pedido que não pode ser atendido.
  if (avaliacao.encerra) {
    return {
      bloqueio: {
        status: 422,
        corpo: {
          error: 'FORMULARIO_ENCERRADO',
          message: avaliacao.encerra.texto,
          details: { perguntaId: avaliacao.encerra.perguntaId, pergunta: avaliacao.encerra.rotulo }
        }
      },
      aceitas: []
    }
  }

  if (avaliacao.faltando.length > 0) {
    return {
      bloqueio: {
        status: 400,
        corpo: {
          error: 'VALIDATION_ERROR',
          message: 'Falta responder às perguntas obrigatórias do formulário',
          details: { respostas: avaliacao.faltando.map((f) => `${f.rotulo} (${f.perguntaId})`) }
        }
      },
      aceitas: []
    }
  }

  // `exigeAnexo` já vem resolvido com a contagem: true significa "cobra anexo e
  // não chegou nenhum".
  if (avaliacao.exigeAnexo) {
    return {
      bloqueio: {
        status: 400,
        corpo: {
          error: 'VALIDATION_ERROR',
          message: 'A resposta escolhida exige anexo',
          details: { anexos: ['Envie ao menos um arquivo junto com o chamado'] }
        }
      },
      aceitas: []
    }
  }

  return { bloqueio: null, aceitas: avaliacao.respostas }
}

export async function criarChamadoPublic(req: Request, res: Response) {
  try {
    const data = CriarChamadoSchema.parse(req.body)

    // ---- formulário dinâmico: respostas + anexos ----
    const { anexos, problemas } = lerAnexosFormulario(req.body?.anexos)
    const { respostas, problema: problemaRespostas } = lerRespostasFormulario(req.body?.respostas)

    if (problemas.length > 0 || problemaRespostas) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: {
          ...(problemas.length > 0 ? { anexos: problemas } : {}),
          ...(problemaRespostas ? { respostas: [problemaRespostas] } : {})
        }
      })
    }

    // O formulário antigo mandava um arquivo só em anexoBase64/anexoNome, no
    // topo do corpo. Entra na mesma lista para o caminho de baixo ser único.
    const anexosTotais: AnexoFormulario[] =
      anexos.length > 0
        ? anexos
        : data.anexoBase64 && data.anexoNome
          ? [{ nome: data.anexoNome, tipo: data.anexoTipo, base64: data.anexoBase64 }]
          : []

    const validacao = await validarFormularioDaAbertura(
      data.categoriaChave,
      respostas,
      anexosTotais.length
    )
    if (validacao.bloqueio) {
      return res.status(validacao.bloqueio.status).json(validacao.bloqueio.corpo)
    }

    const tecnicoSetor = getTecnicoSetor(data.unidade)
    const inventarioStatus = await getInventarioStatus(data.unidade)

    // Protocolo é sequencial por dia; duas requisições simultâneas podem gerar o
    // mesmo número e estourar o unique (P2002). Nesse caso regera e tenta de novo.
    let protocolo = await gerarProtocolo()

    // Os anexos sobem UMA vez, fora da repetição: reenviar a cada tentativa
    // deixaria um arquivo órfão no bucket a cada colisão de protocolo. A pasta
    // usa o primeiro protocolo gerado — numa colisão o número final é outro, o
    // que muda é só o nome da pasta (a URL salva é a que vale).
    const salvos: Array<{ nome: string; tipo: string | null; url: string; path: string }> = []
    for (const a of anexosTotais) {
      const salvo = await salvarAnexoComPath(a.base64, a.nome, a.tipo || '', protocolo)
      if (salvo) salvos.push({ nome: a.nome, tipo: a.tipo || null, ...salvo })
    }

    // Só o que sobreviveu às condições do formulário é gravado — e sempre com o
    // rótulo da pergunta ao lado, para o técnico ler o que a escola leu. Vazio
    // vira NULL, que é o que distingue "chamado sem formulário" de "formulário
    // em branco".
    const formularioRespostas = validacao.aceitas.length > 0 ? validacao.aceitas : null

    let chamado: any = null
    let ultimoErro: any = null
    for (let tentativa = 0; tentativa < 5 && !chamado; tentativa++) {
      if (tentativa > 0) protocolo = await gerarProtocolo()

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
            // `anexoUrl` continua sendo o PRIMEIRO arquivo: as telas antigas e o
            // painel leem só esta coluna, e não há por que mudá-las agora.
            anexoUrl: salvos[0]?.url ?? null,
            email: data.email || null,
            tecnicoSetor,
            categoriaChave: data.categoriaChave || null,
            // `Prisma.DbNull` (e não `null`) porque coluna Json nullable em Prisma 5 exige o
  // marcador explícito para gravar NULL — é o que separa "sem formulário" de
  // "formulário em branco".
  formularioRespostas: formularioRespostas ?? Prisma.DbNull,
            inventarioStatus: inventarioStatus as any,
            anexos: { create: salvos },
            historico: `Chamado criado em ${fmtHoraLocal(new Date())}`
          },
          include: { anexos: { select: { id: true, nome: true, tipo: true, url: true } } }
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

    // 201 com a lista de anexos que de fato subiu: o portal mostra o que foi
    // gravado, e um anexo que o Supabase recusou não aparece como enviado.
    return res.status(201).json({ ...chamado, anexos: salvos.map((a) => ({ nome: a.nome, tipo: a.tipo, url: a.url })) })
  } catch (err) {
    if (isZodError(err)) {
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
      if (temEscopo(req.userRecord)) {
        // Usuário com escopo de tipos: a unidade DEIXA de valer (ele atende
        // todas as escolas) e o que limita é o tipo. Vai em `AND` e não em `OR`
        // porque o `OR` do técnico abaixo é o das unidades — um sobrescreveria
        // o outro.
        where.AND = [
          ...(where.AND || []),
          ...(await clauseDeEscopo(req.userRecord.escopoTipos)),
        ]
      } else if (req.userRecord.nivel === 'TECNICO') {
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
    if (filtros.categoriaChave) {
      const ativas = await prisma.formularioCategoria.findMany({
        where: { ativa: true },
        select: { chave: true, nome: true },
      })

      if (filtros.categoriaChave === CATEGORIA_SEM_CHAVE) {
        // "Sem categoria" = o que NÃO se encaixa em NENHUMA categoria atual.
        // Um simples `categoriaChave IS NULL` não serviria: ele marcaria como
        // "sem categoria" também os chamados antigos cujo `tipo` começa com o
        // nome de uma categoria, e o mesmo chamado apareceria em dois filtros.
        where.AND = [
          ...(where.AND || []),
          ...clausesForaDeTodas(ativas),
        ]
      } else {
        where.AND = [
          ...(where.AND || []),
          clauseDaCategoria({
            chave: filtros.categoriaChave,
            nome: ativas.find((c) => c.chave === filtros.categoriaChave)?.nome,
          }),
        ]
      }
    }
    if (filtros.status) where.status = filtros.status
    if (filtros.urgencia) where.urgencia = { contains: filtros.urgencia, mode: 'insensitive' }
    if (filtros.tecnico) where.tecnicoSetor = filtros.tecnico
    if (filtros.responsavel) where.responsavel = { contains: filtros.responsavel, mode: 'insensitive' }
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
    if (isZodError(err)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

/**
 * Opções do filtro "Técnico" da listagem de chamados.
 *
 * Qualquer usuário autenticado pode chamar: a tela `/chamados` é aberta também
 * por GESTOR/VISUALIZADOR, e para eles um 403 no filtro deixaria a tela com um
 * select morto. Reaproveita `destinoWhere` — a mesma regra de quem pode receber
 * encaminhamento — ou seja, o filtro mostra exatamente quem pode atender.
 *
 * Antes esta rota COMPLEMENTAVA com todo nome que já aparecia como
 * `responsavel` em algum chamado, para o filtro alcançar o trabalho de quem
 * saiu da equipe. Na prática o select encheu de ruído: o mesmo técnico em
 * caixa diferente virava duas opções ("Hebert"/"HERBERT", "Joao"/"JOÃO"),
 * nomes órfãos de conta removida seguiam listados para sempre ("SEINTEC") e
 * as contas de teste dos cenários entravam junto. Como o filtro casa por
 * `contains` sem diferenciar acento, nenhuma dessas opções extras encontrava
 * chamado que a opção do cadastro já não trouxesse — só poluição.
 *
 * Consequência aceita: chamado antigo cujo `responsavel` não bate com o nome
 * do cadastro (ex.: "JOÃO" gravado, cadastro "Joao") deixa de ser alcançável
 * pelo filtro.
 *
 * Fica ANTES de `/:id` para não ser capturada pela rota de chamado por id.
 */
router.get('/filtros/tecnicos', authMiddleware, async (_req: AuthenticatedRequest, res) => {
  try {
    const ativos = await prisma.usuario.findMany({
      where: destinoWhere,
      select: { nome: true },
    })

    // Uma opção por pessoa. A chave é a MAIÚSCULA (o filtro casa sem
    // diferenciar caixa), e vale a PRIMEIRA grafia vista: o cadastro vem antes
    // dos demais e é ele que está grafado por último, então é o mais confável.
    const nomes = new Map<string, string>()
    for (const u of ativos) {
      const nome = u.nome?.trim()
      if (!nome) continue
      const chave = nome.toUpperCase()
      if (!nomes.has(chave)) nomes.set(chave, nome)
    }

    const lista = [...nomes.values()].sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
    )
    return res.json({ data: lista })
  } catch (err) {
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
    if (req.userRecord?.nivel === 'TECNICO' && !(await tecnicoAtende(chamado, req.userRecord))) {
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
    // `instanceof` falha entre as duas cópias do zod (o @shared/api tem a sua) —
    // ver utils/zodError.ts. Sem isso o Express 4 não responde: a requisição fica
    // pendurada em vez de devolver 400.
    if (isZodError(err)) {
      return respostaValidacao(res, err)
    }
    throw err
  }
})

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const chamado = await prisma.chamado.findUnique({
      where: { id: req.params.id },
      // `avaliacao` entra para a escola saber se a nota já foi dada: sem isso o
      // painel mostraria o formulário de estrelas mesmo depois de avaliado, e o
      // envio bateria em 409.
      include: { ...includeDetalhe, avaliacao: { select: { nota: true, comentario: true } } }
    })

    if (!chamado || chamado.excluido) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    if (req.userRecord && req.userRecord.nivel !== 'ADMIN') {
      const canAccess =
        (await tecnicoAtende(chamado, req.userRecord)) ||
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
        (await tecnicoAtende(chamado, req.userRecord)) ||
        ['GESTOR','VISUALIZADOR'].includes(req.userRecord.nivel) && unidadeCasa(chamado.unidade, req.userRecord.filial)

      if (!canUpdate) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão para alterar este chamado' })
      }
    }

    // A escola NÃO mexe no status por esta rota: encerrar o chamado é uma
    // conferência (POST /:id/conferir), que valida se o técnico realmente
    // concluiu antes de aceitar o "ok" — ou reabre o chamado se não.
    if (['GESTOR', 'VISUALIZADOR'].includes(req.userRecord?.nivel || '')) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'A escola confere o serviço pelo botão de conferência do chamado.'
      })
    }

    // Concluir sem descrever o que foi feito deixava a escola sem como conferir.
    if (status === 'AGUARDANDO_CONFERENCIA' && !descricaoResolucao?.trim()) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Registre o que foi feito para o chamado passar à conferência da escola.'
      })
    }

    const agora = new Date()
    const statusAnterior = chamado.status
    const aceitando = status === 'ANDAMENTO' && STATUS_Aguardando_ACEITE.includes(statusAnterior)
    const concluindo = status === 'AGUARDANDO_CONFERENCIA' && statusAnterior !== 'AGUARDANDO_CONFERENCIA'
    const entradaHistorico = `[${fmtHoraLocal(agora)}] Status alterado para "${status}" por ${req.userRecord?.nome || 'Sistema'}${tecnicoResolucao ? ` (técnico: ${tecnicoResolucao})` : ''}${descricaoResolucao ? `\nDescrição da resolução: ${descricaoResolucao}` : ''}${status === 'COMUNICADO' && pergunta?.trim() ? `\nPergunta para a escola: ${pergunta.trim()}` : ''}`

    const updated = await prisma.chamado.update({
      where: { id: req.params.id },
      data: {
        status,
        responsavel: responsavel || req.userRecord?.nome || chamado.responsavel,
        ultimaAtualizacao: agora,
        tecnicoResolucao: tecnicoResolucao || chamado.tecnicoResolucao,
        descricaoResolucao: descricaoResolucao || chamado.descricaoResolucao,
        // Só carimba o aceite vindo de ABERTO/ENCAMINHADO: a resposta da escola
        // a COMUNICADO também joga para ANDAMENTO e não é um novo aceite.
        // `concluidoEm` estritamente na ida para AGUARDANDO_CONFERENCIA — é o
        // momento em que o técnico entregou o serviço; `conferidoEm` é o que
        // marca RESOLVIDO (pela conferência da escola).
        ...(aceitando ? { aceitoEm: agora, aceitoPor: req.userRecord?.nome || 'Sistema' } : {}),
        concluidoEm:
          status === 'AGUARDANDO_CONFERENCIA'
            ? agora
            : status === 'RESOLVIDO'
              ? (chamado.concluidoEm ?? agora)
              : statusAnterior === 'RESOLVIDO'
                ? null
                : chamado.concluidoEm,
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
    } else if ((status === 'AGUARDANDO_CONFERENCIA' || status === 'RESOLVIDO') && status !== statusAnterior) {
      notificarUnidade(chamado.unidade, 'CHAMADO_FINALIZADO', `Chamado ${chamado.protocolo} concluído`, chamado.descricaoResolucao || 'O chamado foi concluído pela equipe.', `/chamados/${chamado.id}`).catch(() => {})
    }

    const completo = await prisma.chamado.findUnique({ where: { id: updated.id }, include: includeDetalhe })
    return res.json(completo ?? updated)
  } catch (err) {
    if (isZodError(err)) {
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
        (await tecnicoAtende(chamado, req.userRecord)) ||
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

    const completo = await prisma.chamado.findUnique({ where: { id: updated.id }, include: includeDetalhe })
    return res.json(completo ?? updated)
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

/* =================================================================
 * FLUXO DE ATENDIMENTO
 *
 * ABERTO ──▶ ENCAMINHADO ──▶ ANDAMENTO ──▶ AGUARDANDO_CONFERENCIA ──▶ RESOLVIDO
 *   ▲                                                              (escola)
 *   └──────────────── contestação da escola (+1 reabertura) ──────────┘
 *
 * Os quatro passos abaixo são endpoints separados (e não um PATCH genérico de
 * status) porque cada um tem permissão, pré-condição, registro obrigatório e
 * notificação própria — espremer isso num único `PATCH /status` foi o que deixou
 * a escola fechar chamado que o técnico não concluiu.
 * ================================================================= */

/** Carrega o chamado garantindo que ele existe e não está excluído. */
async function carregarChamadoAtivo(id: string) {
  const chamado = await prisma.chamado.findUnique({ where: { id } })
  if (!chamado || chamado.excluido) return null
  return chamado
}

/**
 * ACEITE — o técnico assume o chamado. É o que libera registrar atividade e
 * concluir, e grava o marco do horário (vem do servidor, não do relógio do
 * navegador).
 */
router.post('/:id/aceitar', authMiddleware, requireRole('ADMIN', 'TECNICO'), async (req: AuthenticatedRequest, res) => {
  try {
    const chamado = await carregarChamadoAtivo(req.params.id)
    if (!chamado) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    // TECNICO pode aceitar se é o responsável OU atende a unidade do chamado
    // (aceitar é "assumir" o serviço; um colega de plantão pode pegar o caso).
    // Com escopo de tipos, atende o chamado pelo tipo, de qualquer escola.
    if (req.userRecord?.nivel === 'TECNICO' && !ehDonoDoChamado(chamado, req.userRecord) && !(await tecnicoAtende(chamado, req.userRecord))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem acesso a este chamado' })
    }

    if (chamado.status === 'RESOLVIDO') {
      return res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Chamado já está concluído.' })
    }

    // Já aceito nesta etapa: resposta idempotente — não regrava histórico nem datas.
    if (chamado.aceitoEm && ['ANDAMENTO', 'COMUNICADO', 'AGUARDANDO_CONFERENCIA'].includes(chamado.status)) {
      const atual = await prisma.chamado.findUnique({ where: { id: chamado.id }, include: includeDetalhe })
      return res.json(atual ?? chamado)
    }

    const agora = new Date()
    const autor = req.userRecord?.nome || 'Sistema'
    const entrada = `[${fmtHoraLocal(agora)}] Chamado aceito por ${autor}`
    // ABERTO/ENCAMINHADO viram ANDAMENTO; COMUNICADO permanece COMUNICADO (a
    // pergunta está na frente da escola; o aceite só registra que estou dono).
    const statusNovo = chamado.status === 'ABERTO' || chamado.status === 'ENCAMINHADO' ? 'ANDAMENTO' : chamado.status

    const updated = await prisma.chamado.update({
      where: { id: chamado.id },
      data: {
        status: statusNovo,
        aceitoEm: chamado.aceitoEm ?? agora,
        aceitoPor: chamado.aceitoEm ? (chamado.aceitoPor ?? autor) : autor,
        responsavel: chamado.responsavel || autor,
        responsavelId: chamado.responsavelId || req.userRecord?.id,
        ultimaAtualizacao: agora,
        historico: `${chamado.historico || ''}\n${entrada}`.trim()
      }
    })

    notificarAdmins(
      'CHAMADO_RESPONDIDO',
      `Chamado ${chamado.protocolo} aceito por ${autor}`,
      `${chamado.unidade} — ${chamado.tipo}`,
      `/chamados/${chamado.id}`
    ).catch(() => {})

    const completo = await prisma.chamado.findUnique({ where: { id: updated.id }, include: includeDetalhe })
    return res.json(completo ?? updated)
  } catch (err) {
    if (isZodError(err)) {
      return respostaValidacao(res, err)
    }
    throw err
  }
})

/**
 * REGISTRO DO QUE FOI FEITO — pode repetir quantas vezes quiser; cada envio é
 * uma linha nova com data/hora do servidor. Exige aceite no ciclo atual.
 */
router.post('/:id/atividades', authMiddleware, requireRole('ADMIN', 'TECNICO'), async (req: AuthenticatedRequest, res) => {
  try {
    const { texto, anexos } = RegistrarAtividadeSchema.parse(req.body)

    const chamado = await carregarChamadoAtivo(req.params.id)
    if (!chamado) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    if (!ehDonoDoChamado(chamado, req.userRecord)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Só quem é o responsável pelo chamado pode registrar o atendimento' })
    }

    if (!STATUS_COM_TECNICO_ACEITO.includes(chamado.status)) {
      return res.status(409).json({
        error: 'CONFLICT',
        message: 'Aceite o chamado antes de registrar o atendimento.'
      })
    }

    const autor = req.userRecord?.nome || 'Sistema'
    const agora = new Date()
    const atividade = await salvarAtividade(
      chamado.id,
      chamado.protocolo,
      'REGISTRO',
      autor,
      req.userRecord?.nivel,
      texto,
      anexos
    )

    await prisma.chamado.update({
      where: { id: chamado.id },
      data: {
        ultimaAtualizacao: agora,
        historico: `${chamado.historico || ''}\n[${fmtHoraLocal(agora)}] Registro de atendimento por ${autor}: ${texto}`.trim()
      }
    })

    notificarAdmins(
      'CHAMADO_ATIVIDADE',
      `Registro de atendimento no chamado ${chamado.protocolo}`,
      `${autor}: ${texto}`,
      `/chamados/${chamado.id}`
    ).catch(() => {})

    return res.status(201).json(atividade)
  } catch (err) {
    if (isZodError(err)) {
      return respostaValidacao(res, err)
    }
    throw err
  }
})

/**
 * CONCLUSÃO DO TÉCNICO — o que ele fez está no registro, e a bola passa para a
 * escola conferir. Não é mais o fim do chamado: quem encerra é a escola.
 */
router.post('/:id/concluir', authMiddleware, requireRole('ADMIN', 'TECNICO'), async (req: AuthenticatedRequest, res) => {
  try {
    const { descricaoResolucao, anexos } = ConcluirChamadoSchema.parse(req.body)

    const chamado = await carregarChamadoAtivo(req.params.id)
    if (!chamado) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    if (!ehDonoDoChamado(chamado, req.userRecord)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Só quem é o responsável pelo chamado pode concluí-lo' })
    }

    if (!STATUS_COM_TECNICO_ACEITO.includes(chamado.status)) {
      return res.status(409).json({
        error: 'CONFLICT',
        message: 'Aceite o chamado antes de concluir.'
      })
    }

    const agora = new Date()
    const autor = req.userRecord?.nome || 'Sistema'
    const entrada = `[${fmtHoraLocal(agora)}] Conclusão registrada por ${autor}\nDescrição da resolução: ${descricaoResolucao}`

    await salvarAtividade(chamado.id, chamado.protocolo, 'CONCLUSAO', autor, req.userRecord?.nivel, descricaoResolucao, anexos)

    const updated = await prisma.chamado.update({
      where: { id: chamado.id },
      data: {
        status: 'AGUARDANDO_CONFERENCIA',
        concluidoEm: agora,
        // `descricaoResolucao`/`tecnicoResolucao` guardam só a ÚLTIMA
        // conclusão: o histórico de todas as tentativas fica nas atividades.
        tecnicoResolucao: autor,
        descricaoResolucao,
        ultimaAtualizacao: agora,
        historico: `${chamado.historico || ''}\n${entrada}`.trim()
      }
    })

    // A escola precisa saber que há o que conferir; o e-mail segue o mesmo
    // caminho de sempre (mudança de status).
    notificarUnidade(
      chamado.unidade,
      'CHAMADO_FINALIZADO',
      `Chamado ${chamado.protocolo} concluído pelo técnico`,
      descricaoResolucao,
      `/chamados/${chamado.id}`
    ).catch(() => {})
    await notificarChamadoStatusAlterado(updated)

    const completo = await prisma.chamado.findUnique({ where: { id: updated.id }, include: includeDetalhe })
    return res.json(completo ?? updated)
  } catch (err) {
    if (isZodError(err)) {
      return respostaValidacao(res, err)
    }
    throw err
  }
})

/**
 * CONFERÊNCIA DA ESCOLA — o passo que faltava: a unidade verifica o que o
 * técnico fez e é quem encerra o chamado.
 *
 *   aprovado   → RESOLVIDO (com horário e nome de quem deu o ok)
 *   contestado → ABERTO, +1 reabertura, admins + técnico responsável avisados
 */
router.post('/:id/conferir', authMiddleware, requireRole('GESTOR', 'VISUALIZADOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const { aprovado, texto, anexos } = ConferirChamadoSchema.parse(req.body)

    const chamado = await carregarChamadoAtivo(req.params.id)
    if (!chamado) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Chamado não encontrado' })
    }

    if (!unidadeCasa(chamado.unidade, req.userRecord!.filial)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem acesso a este chamado' })
    }

    if (chamado.status !== 'AGUARDANDO_CONFERENCIA') {
      return res.status(409).json({
        error: 'CONFLICT',
        message: 'Só é possível conferir chamado que o técnico concluiu e está aguardando conferência.'
      })
    }

    const agora = new Date()
    const autor = req.userRecord?.nome || 'Escola'
    const link = `/chamados/${chamado.id}`

    if (aprovado) {
      const comentario = texto?.trim()
      if (comentario) {
        await salvarAtividade(chamado.id, chamado.protocolo, 'APROVACAO', autor, req.userRecord?.nivel, comentario, anexos)
      }

      const updated = await prisma.chamado.update({
        where: { id: chamado.id },
        data: {
          status: 'RESOLVIDO',
          conferidoEm: agora,
          conferidoPor: autor,
          ultimaAtualizacao: agora,
          historico: `${chamado.historico || ''}\n[${fmtHoraLocal(agora)}] Conferência aprovada pela escola (${autor})${comentario ? ` — ${comentario}` : ''}`.trim()
        }
      })

      // Quem executou precisa saber que o serviço foi validado, e não esquecido.
      notificarTecnicoResponsavel(
        chamado,
        'CHAMADO_APROVADO',
        `Chamado ${chamado.protocolo} confirmado pela escola`,
        `${chamado.unidade} confirmou que o serviço foi concluído.`,
        link
      ).catch(() => {})

      await notificarChamadoStatusAlterado(updated)

      const completo = await prisma.chamado.findUnique({ where: { id: updated.id }, include: includeDetalhe })
      return res.json(completo ?? updated)
    }

    // Contestação: o texto é o que diz o que faltou (o Zod já exige).
    const motivo = texto!.trim()
    await salvarAtividade(chamado.id, chamado.protocolo, 'CONTESTACAO', autor, req.userRecord?.nivel, motivo, anexos)

    const updated = await prisma.chamado.update({
      where: { id: chamado.id },
      data: {
        status: 'ABERTO',
        reaberturas: { increment: 1 },
        ultimaAtualizacao: agora,
        historico: `${chamado.historico || ''}\n[${fmtHoraLocal(agora)}] Chamado contestado pela escola (${autor}) e reaberto\nO que ficou faltando: ${motivo}`.trim()
      }
    })

    const aviso = `A escola informou o que ficou faltando: ${motivo}`
    notificarAdmins(
      'CHAMADO_REABERTO',
      `Chamado ${chamado.protocolo} contestado pela escola`,
      aviso,
      link
    ).catch(() => {})
    notificarTecnicoResponsavel(chamado, 'CHAMADO_REABERTO', `Chamado ${chamado.protocolo} foi reaberto`, aviso, link).catch(() => {})

    const completo = await prisma.chamado.findUnique({ where: { id: updated.id }, include: includeDetalhe })
    return res.json(completo ?? updated)
  } catch (err) {
    if (isZodError(err)) {
      return respostaValidacao(res, err)
    }
    throw err
  }
})

router.patch('/batch', authMiddleware, requireRole('ADMIN', 'TECNICO'), async (req: AuthenticatedRequest, res) => {
  try {
    const { ids, status, tecnicoResolucao, resposta } = BatchUpdateChamadosSchema.parse(req.body)

    if (req.userRecord && req.userRecord.nivel !== 'ADMIN') {
      const chamados = await prisma.chamado.findMany({ where: { id: { in: ids } } })
      // Laço com `await` em vez de `.some()`: `tecnicoAtende` é assíncrono
      // (resolve o escopo de tipos). Numa lista pequena de ids a query extra
      // de nomes de categoria é a mesma para todos — o custo é de uma por lote.
      let unauthorized = false
      for (const c of chamados) {
        if (!(await tecnicoAtende(c, req.userRecord))) {
          unauthorized = true
          break
        }
      }
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
          // Mesmo carimbo do PATCH individual: grava na 1ª conclusão, zera se reaberto.
          concluidoEm: status
            ? (status === 'RESOLVIDO' ? (chamado.concluidoEm ?? agora) : null)
            : chamado.concluidoEm,
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
    if (isZodError(err)) {
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
    if (isZodError(err)) {
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
        (await tecnicoAtende(chamado, req.userRecord)) ||
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
    if (isZodError(err)) {
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
