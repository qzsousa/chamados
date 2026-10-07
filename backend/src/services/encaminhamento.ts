/**
 * Encaminhamento de chamados para técnicos.
 *
 * Duas entradas:
 *  1. AUTOMÁTICO — chamado criado pela escola numa categoria com regra ativa
 *     (ex.: 'equipamento') já nasce encaminhado para o técnico da unidade.
 *  2. MANUAL — matriz encaminha/reencaminha pelo modal de detalhes do chamado
 *     (o solicitante pode ter escolhido a categoria errada).
 *
 * Encaminhar = gravar o `responsavel`, deixar registro no `historico` e
 * notificar o técnico no sino (o deep-link /chamados/<id> já abre o chamado).
 * Se não houver técnico cadastrado para a unidade, nada é quebrado: o chamado
 * segue sem responsável e os admins continuam sendo notificados como antes.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma'
import { normalizarNomeEscola } from './normalization'
import { notificarUsuario } from './notificacoes'
import { normalizarUnidade, unidadesDoUsuario, usuarioAtendeUnidade } from './unidades'

export type ModoEncaminhamento = 'UNIDADE' | 'TECNICO'

/** Campos do chamado usados no encaminhamento (independe do tipo gerado do Prisma). */
export interface ChamadoParaEncaminhar {
  id: string
  protocolo: string
  unidade: string
  tipo: string
  urgencia: string
  responsavel: string | null
  status: string
  categoriaChave?: string | null
  historico?: string | null
}
export interface RegraEncaminhamento {
  categoriaChave: string
  modo: ModoEncaminhamento
  tecnicoId: string | null
  tecnicoNome?: string | null
}

export interface TecnicoDestino {
  id: string
  nome: string
  email: string
  filial: string
  abertos: number
}

/** O tipo gravado na Notificação: encaminhamento é um chamado novo para o técnico. */
const TIPO_NOTIFICACAO = 'CHAMADO_NOVO' as const

/**
 * Quem pode receber um encaminhamento.
 *
 * ADMIN entra porque é o nível mais alto do sistema: os chefes do setor
 * (SEINTEC/SETEC), o técnico sênior e os estagiários atendem chamado de
 * sistema e de e-mail junto com os juniores — nenhum deles tem a conta
 * TECNICO, mas todos precisam poder ficar com o chamado. TECNICO são os
 * juniores e volantes que vão até a unidade fazer manutenção.
 *
 * Fica AQUI, e não repetido em cada rota, para que lista de destino e
 * validação de `tecnicoId` nunca aceitem conjunto diferente um do outro.
 */
export const NIVEIS_DESTINO: string[] = ['ADMIN', 'TECNICO']

/** Filtro Prisma dos usuários que podem receber encaminhamento. */
export const destinoWhere: Prisma.UsuarioWhereInput = {
  nivel: { in: NIVEIS_DESTINO },
  status: 'ATIVO',
}

/** Fuso de Brasília para o histórico (o servidor roda em UTC). */
function fmtHoraLocal(d: Date): string {
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

/**
 * O chamado pertence a esta regra?
 * - Preferência: `categoriaChave` gravada na criação (imune a renomeação).
 * - Fallback (chamados antigos): o `tipo` começa com o nome da categoria.
 */
export function casaComRegra(
  chamado: ChamadoParaEncaminhar,
  regra: RegraEncaminhamento,
  nomeCategoria?: string | null,
): boolean {
  if (chamado.categoriaChave) return chamado.categoriaChave === regra.categoriaChave
  if (!nomeCategoria) return false
  const tipo = normalizarNomeEscola(chamado.tipo)
  const nome = normalizarNomeEscola(nomeCategoria)
  if (!nome || nome.length < 3) return false
  return tipo === nome || tipo.startsWith(`${nome} `)
}

/** Quantidade de chamados abertos (não concluídos) de cada técnico. */
async function abertosPorTecnico(nomes: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>(nomes.map((n) => [n, 0]))
  if (!nomes.length) return mapa
  const grupos = await prisma.chamado.groupBy({
    by: ['responsavel'],
    where: { responsavel: { in: nomes }, status: { not: 'RESOLVIDO' }, excluido: false },
    _count: { _all: true },
  })
  for (const g of grupos) {
    if (g.responsavel) mapa.set(g.responsavel, g._count._all)
  }
  return mapa
}

/**
 * Técnico que atende a unidade: usuarios TECNICO ativos cuja lista de unidades
 * inclui a escola. Desempate: casa exata > casa por schools irmãs > menos
 * chamados abertos > cadastro mais antigo.
 *
 * Só TECNICO, mesmo com ADMIN valendo como destino: o encaminhamento
 * automático é o do volante da unidade, e o chefe entra na fila só se o
 * Admin escolher a mão (o "Técnico da unidade" do modal).
 */
export async function tecnicosDaUnidade(unidade: string): Promise<TecnicoDestino[]> {
  const candidatos = await prisma.usuario.findMany({
    where: { nivel: 'TECNICO', status: 'ATIVO' },
    select: { id: true, nome: true, email: true, filial: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const alvo = normalizarUnidade(unidade)
  const elegiveis = candidatos
    .map((c) => {
      const exata = unidadesDoUsuario(c.filial).some((u) => normalizarUnidade(u) === alvo)
      const casa = exata || usuarioAtendeUnidade(c.filial, unidade)
      return { ...c, casa, exata }
    })
    .filter((c) => c.casa)

  if (!elegiveis.length) return []
  const abertos = await abertosPorTecnico(elegiveis.map((c) => c.nome))

  return elegiveis
    .map((c) => ({
      destino: { id: c.id, nome: c.nome, email: c.email, filial: c.filial, abertos: abertos.get(c.nome) ?? 0 },
      exata: c.exata,
    }))
    .sort((a, b) => {
      if (a.exata !== b.exata) return a.exata ? -1 : 1
      if (a.destino.abertos !== b.destino.abertos) return a.destino.abertos - b.destino.abertos
      return 0 // createdAt asc já veio da query
    })
    .map((r) => r.destino)
}

async function tecnicoFixo(tecnicoId: string): Promise<TecnicoDestino | null> {
  const u = await prisma.usuario.findFirst({
    where: { id: tecnicoId, ...destinoWhere },
    select: { id: true, nome: true, email: true, filial: true },
  })
  if (!u) return null
  return { ...u, abertos: 0 }
}

/** Resolve o técnico de destino conforme a regra/modo informado. */
export async function resolverTecnico(
  unidade: string,
  opcoes: { modo: ModoEncaminhamento; tecnicoId?: string | null },
): Promise<TecnicoDestino | null> {
  if (opcoes.modo === 'TECNICO' && opcoes.tecnicoId) {
    return tecnicoFixo(opcoes.tecnicoId)
  }
  const [primeiro] = await tecnicosDaUnidade(unidade)
  return primeiro ?? null
}

export interface ResultadoEncaminhamento {
  ok: boolean
  tecnico: TecnicoDestino | null
  chamado: ChamadoParaEncaminhar | null
  motivo?: string
}

/**
 * Encaminha o chamado: grava responsável + histórico e notifica o técnico.
 * `origem` é 'Automático' ou 'Manual' e vai para o histórico.
 */
export async function encaminharChamado(
  chamado: ChamadoParaEncaminhar,
  opcoes: {
    modo: ModoEncaminhamento
    tecnicoId?: string | null
    observacao?: string
    /** 'Automático' (regra) ou 'Manual' (modal de detalhes) — entra no histórico. */
    origem?: 'Automático' | 'Manual'
    /** Quem encaminhou manualmente (nome do usuário da matriz). */
    autor?: string
  } = { modo: 'UNIDADE' },
): Promise<ResultadoEncaminhamento> {
  const tecnico = await resolverTecnico(chamado.unidade, opcoes)
  const origem = opcoes.origem ?? 'Automático'

  if (!tecnico) {
    const motivo = 'Nenhum técnico ativo atendendo esta unidade está cadastrado.'
    const entrada = `[${fmtHoraLocal(new Date())}] Sem técnico para encaminhamento: ${motivo}`
    const atualizado = await prisma.chamado.update({
      where: { id: chamado.id },
      data: { historico: `${chamado.historico || ''}\n${entrada}`.trim() },
    })
    return { ok: false, tecnico: null, chamado: atualizado, motivo }
  }

  const agora = new Date()
  const destino = opcoes.modo === 'TECNICO' ? 'técnico fixo' : 'técnico da unidade'
  const observacao = opcoes.observacao?.trim()
  const quem = opcoes.autor?.trim()
  const entrada =
    `[${fmtHoraLocal(agora)}] Encaminhado para ${tecnico.nome} (${destino})` +
    (origem === 'Manual' ? ` — manual por ${quem || 'matriz'}` : ' — automático') +
    (observacao ? ` — Obs.: ${observacao}` : '')

  const atualizado = await prisma.chamado.update({
    where: { id: chamado.id },
    data: {
      responsavel: tecnico.nome,
      // `responsavel` é nome (é o que o filtro e a lista de chamados usam), mas
      // a notificação de reabertura/conferência precisa do id do usuário.
      responsavelId: tecnico.id,
      // Encaminhar tira o chamado da fila da matriz e põe na fila do técnico.
      // Reencaminhar um chamado já em atendimento não volta o status: o técnico
      // pode estar no meio do serviço e só ser trocado de responsável.
      status: chamado.status === 'ABERTO' ? 'ENCAMINHADO' : chamado.status,
      historico: `${chamado.historico || ''}\n${entrada}`.trim(),
      ultimaAtualizacao: agora,
    },
  })

  // Notificação nunca pode derrubar o encaminhamento.
  try {
    await notificarUsuario(
      tecnico.id,
      TIPO_NOTIFICACAO,
      `Chamado ${chamado.protocolo} encaminhado para você`,
      `${chamado.unidade} — ${chamado.tipo} (${chamado.urgencia})`,
      `/chamados/${chamado.id}`,
    )
  } catch {
    /* silencioso: o encaminhamento já foi gravado */
  }

  return { ok: true, tecnico, chamado: atualizado }
}

/** Regras ativas, indexadas por chave de categoria. */
export async function regrasAtivas(): Promise<RegraEncaminhamento[]> {
  const regras = await prisma.encaminhamentoRegra.findMany({ where: { ativa: true } })
  return regras.map((r) => ({
    categoriaChave: r.categoriaChave,
    modo: (r.modo as ModoEncaminhamento) || 'UNIDADE',
    tecnicoId: r.tecnicoId,
    tecnicoNome: r.tecnicoNome,
  }))
}

/** Nome da categoria no formulário (para casar chamados antigos pelo `tipo`). */
async function nomeDaCategoria(chave: string): Promise<string | null> {
  const cat = await prisma.formularioCategoria.findUnique({ where: { chave }, select: { nome: true } })
  return cat?.nome ?? null
}

/**
 * Encaminha o chamado conforme as regras ativas. Usado na criação pública.
 * Só age em chamado sem responsável (não toma o meio de um encaminhamento
 * já feito) e devolve se encaminhou.
 */
export async function encaminharPorRegras(chamado: ChamadoParaEncaminhar): Promise<boolean> {
  if (chamado.responsavel) return false
  const chave = chamado.categoriaChave
  const regras = await regrasAtivas()
  const candidatas = chave
    ? regras.filter((r) => r.categoriaChave === chave)
    : []

  for (const regra of candidatas) {
    const nome = await nomeDaCategoria(regra.categoriaChave)
    if (!casaComRegra(chamado, regra, nome)) continue
    const r = await encaminharChamado(chamado, { modo: regra.modo, tecnicoId: regra.tecnicoId, origem: 'Automático' })
    return r.ok
  }

  // Sem `categoriaChave` (chamado antigo): tenta casar pelo nome em todas as regras.
  if (!chave) {
    for (const regra of regras) {
      const nome = await nomeDaCategoria(regra.categoriaChave)
      if (!nome || !casaComRegra(chamado, regra, nome)) continue
      const r = await encaminharChamado(chamado, { modo: regra.modo, tecnicoId: regra.tecnicoId, origem: 'Automático' })
      return r.ok
    }
  }

  return false
}

/**
 * Aplica as regras nos chamados abertos que ainda não têm responsável
 * (botão "Aplicar agora" das Configurações).
 */
export async function encaminharPendentes(): Promise<{ total: number; encaminhados: number; semTecnico: number }> {
  const regras = await regrasAtivas()
  if (!regras.length) return { total: 0, encaminhados: 0, semTecnico: 0 }

  const nomesCategorias = new Map<string, string | null>()
  for (const r of regras) nomesCategorias.set(r.categoriaChave, await nomeDaCategoria(r.categoriaChave))

  const pendentes = await prisma.chamado.findMany({
    where: { excluido: false, status: { not: 'RESOLVIDO' }, responsavel: null },
    orderBy: { timestamp: 'asc' },
  })

  let encaminhados = 0
  let semTecnico = 0
  for (const chamado of pendentes) {
    const regra = regras.find((r) => casaComRegra(chamado, r, nomesCategorias.get(r.categoriaChave) ?? null))
    if (!regra) continue
    const r = await encaminharChamado(chamado, { modo: regra.modo, tecnicoId: regra.tecnicoId, origem: 'Automático' })
    if (r.ok) encaminhados++
    else semTecnico++
  }
  return { total: pendentes.length, encaminhados, semTecnico }
}
