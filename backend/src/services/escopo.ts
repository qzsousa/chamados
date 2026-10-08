/**
 * Escopo de TIPOS de chamado por usuário.
 *
 * Um usuário pode ser cadastrado para atender só alguns tipos de chamado, de
 * qualquer escola. É o caso de quem é da área de sistemas e não da rede: a
 * pessoa atende PortalNet e SEI e não deve ver — nem receber — chamado de
 * equipamento.
 *
 * COMO O ESCOPO É GRAVADO
 *
 * `Usuario.escopoTipos` é uma lista de `"<chaveDaCategoria>::<rótulo da
 * opção>"`, ex.: `["sistemas::PortalNet", "sistemas::SEI"]`.
 *
 * - **Lista vazia = SEM RESTRIÇÃO.** O usuário se comporta exatamente como
 *   antes, respeitando só o `filial`. Nenhum usuário já cadastrado muda de
 *   comportamento, e é por isso que o campo é um array com default em vez de
 *   uma coluna nullable ou uma tabela nova.
 * - A chave (`FormularioCategoria.chave`) sobrevive a renomear a categoria.
 *   O rótulo da opção NÃO sobrevive a renomeá-la no formulário de
 *   Configurações — o escopo fica órfão e o usuário volta a ver tudo. Mesma
 *   classe de consequência já aceita para `Chamado.responsavel`, que também
 *   casa por nome.
 * - Rótulo vazio (`"email::"`) significa a CATEGORIA INTEIRA. É o que acontece
 *   com uma categoria cuja 1ª pergunta não é de opções (o "E-mail
 *   institucional" começa pelo CIE da escola): não há tipo a listar, então o
 *   escopo cai para a categoria.
 *
 * A trava de escopo SUBSTITUI a trava de unidade: com escopo preenchido, o
 * `filial` deixa de valer para chamados (o usuário atende todas as escolas) e
 * o que limita é o tipo. Sem escopo, o `filial` manda, como sempre.
 *
 * Este módulo é a fonte única do casamento tipo↔chamado: o filtro de Prisma
 * (listagem, indicadores) e a comparação em memória (rota de detalhe, aceite)
 * usam as MESMAS funções, senão um chamado apareceria na lista e daria 403 ao
 * clicar nele.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma'

/** Separador entre chave da categoria e rótulo da opção. */
export const SEPARADOR = '::'

/** Limite de `tipo` gravado na criação do chamado (`tipoFinal` trunca em 100). */
const LIMITE_TIPO = 100

/** Só os campos do usuário que o escopo precisa. `nivel` não é consultado aqui. */
export interface UsuarioComEscopo {
  filial?: string | null
  nome?: string | null
  escopoTipos?: string[] | null
}

export interface TipoEscopo {
  chave: string
  /** Rótulo da 1ª opção da categoria. Vazio = a categoria inteira. */
  rotulo: string
}

/** Monta o valor gravado no `escopoTipos` (rótulo vazio = categoria inteira). */
export function montarEscopo(chave: string, rotulo?: string | null): string {
  return `${chave}${SEPARADOR}${rotulo ? rotulo.trim() : ''}`
}

/** Desmonta `"chave::rótulo"`. Devolve `null` para valor malformado. */
export function quebrarEscopo(valor: string): TipoEscopo | null {
  const i = valor.indexOf(SEPARADOR)
  if (i <= 0) return null
  const chave = valor.slice(0, i).trim()
  if (!chave) return null
  return { chave, rotulo: valor.slice(i + SEPARADOR.length).trim() }
}

/** Escopo do usuário já quebrado, ignorando valores malformados. */
export function tiposDoUsuario(user: UsuarioComEscopo | null | undefined): TipoEscopo[] {
  const lista = user?.escopoTipos
  if (!Array.isArray(lista) || !lista.length) return []
  return lista
    .filter((v): v is string => typeof v === 'string')
    .map(quebrarEscopo)
    .filter((t): t is TipoEscopo => t !== null)
}

/** O usuário tem escopo de tipo? (false = respeita só o `filial`, como sempre) */
export function temEscopo(user: UsuarioComEscopo | null | undefined): boolean {
  return tiposDoUsuario(user).length > 0
}

/**
 * Normaliza para comparar `tipo` com `<categoria> - <opção>`.
 *
 * Só caixa e espaços: acento é preservado de propósito, porque o `tipo` foi
 * montado com o nome da categoria TAL COMO ESTÁ no banco — se o nome tiver
 * acento, os dois lados têm.
 */
function normTipo(valor: string | null | undefined): string {
  return String(valor || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * `<Nome da categoria> - <rótulo>` (ou só o nome, quando o escopo é a
 * categoria inteira). Espelha `tipoFinal()` do formulário público.
 */
export function prefixoDoTipo(nomeCategoria: string, rotulo: string): string {
  const base = rotulo ? `${nomeCategoria} - ${rotulo}` : nomeCategoria
  return base.slice(0, LIMITE_TIPO)
}

/**
 * Nomes das categorias pedidas, indexados por chave.
 *
 * Traz categorias INATIVAS de propósito: uma categoria desativada não aparece
 * mais no formulário de abertura, mas os chamados já abertos continuam no
 * banco e o técnico com escopo ainda precisa enxergá-los.
 */
export async function nomesDasCategorias(chaves: string[]): Promise<Map<string, string>> {
  const unicas = [...new Set(chaves.filter(Boolean))]
  if (!unicas.length) return new Map()
  const categorias = await prisma.formularioCategoria.findMany({
    where: { chave: { in: unicas } },
    select: { chave: true, nome: true },
  })
  return new Map(categorias.map((c) => [c.chave, c.nome]))
}

/**
 * Os valores de `escopoTipos` que NÃO correspondem a nada do formulário.
 *
 * Usado pelo `POST`/`PATCH /usuarios` para recusar com 400 em vez de gravar um
 * escopo que não encontraria chamado nenhum (silenciosamente o usuário voltaria
 * a ver tudo, que é o pior desfecho possível para uma restrição de acesso).
 *
 * Categoria inteira (rótulo vazio) é sempre válida. Com rótulo, a opção precisa
 * existir em alguma pergunta de OPCOES ativa da categoria — é a 1ª pergunta de
 * opções que define o `tipo` do chamado, e o `array_contains` do Postgres
 * resolve pelo rótulo sem precisar baixar o JSON.
 */
export async function escoposInvalidos(escopo: string[]): Promise<string[]> {
  // Malformado é inválido SEMPRE, mesmo ao lado de valores bons: um valor que
  // não quebra é silenciosamente ignorado na hora de filtrar (`temEscopo` volta
  // a falso) e o usuário passaria a ver TUDO achando que estava restrito.
  const invalidos = new Set(escopo.filter((valor) => quebrarEscopo(valor) === null))
  const tipos = escopo
    .map(quebrarEscopo)
    .filter((t): t is TipoEscopo => t !== null)
  if (!tipos.length) return escopo.filter((v) => invalidos.has(v))

  const nomes = await nomesDasCategorias(tipos.map((t) => t.chave))
  for (const t of tipos) {
    if (!nomes.has(t.chave)) invalidos.add(montarEscopo(t.chave, t.rotulo))
  }

  for (const t of tipos.filter((t) => t.rotulo && nomes.has(t.chave))) {
    const pergunta = await prisma.formularioPergunta.findFirst({
      where: {
        categoria: { chave: t.chave },
        ativa: true,
        tipo: 'OPCOES',
        opcoes: { array_contains: [{ rotulo: t.rotulo }] },
      },
      select: { id: true },
    })
    if (!pergunta) invalidos.add(montarEscopo(t.chave, t.rotulo))
  }

  // Na ordem em que chegaram: a mensagem de erro lista o que o ADMIN marcou.
  return escopo.filter((v) => invalidos.has(v))
}

/**
 * Cláusulas de Prisma que restringem a listagem aos tipos do escopo.
 *
 * Devolve um ARRAY para entrar em `where.AND` — a listagem de chamados já usa
 * `where.AND` para o filtro de categoria (`clausesForaDeTodas`), e sobrescrever
 * em vez de anexar apagaria um dos dois.
 *
 * Por tipo são DUAS alternativas, e o `startsWith` sozinho não serviria: o
 * `tipo` é `<categoria> - <1ª resposta>` e nada garante que a resposta termine
 * ali. Sem o " - " à frente, o escopo "sistemas::SEI" também traria
 * "Sistemas - SEIplus". Chamados sem nenhuma resposta (categoria cuja 1ª
 * pergunta é de TEXTO) têm `tipo` igual ao nome da categoria — daí a
 * alternativa por igualdade.
 */
export async function clauseDeEscopo(escopo: string[]): Promise<Prisma.ChamadoWhereInput[]> {
  const tipos = escopo.map(quebrarEscopo).filter((t): t is TipoEscopo => t !== null)
  if (!tipos.length) return []
  const nomes = await nomesDasCategorias(tipos.map((t) => t.chave))

  const clausulas: (Prisma.ChamadoWhereInput | null)[] = tipos.map((t) => {
    const nome = nomes.get(t.chave)
    if (!nome) return null // categoria desconhecida: não há com o que casar
    const prefixo = prefixoDoTipo(nome, t.rotulo)
    if (!prefixo) return null
    return {
      OR: [
        { tipo: { equals: prefixo, mode: 'insensitive' as const } },
        { tipo: { startsWith: `${prefixo} - `, mode: 'insensitive' as const } },
      ],
    }
  })

  return clausulas.filter((c): c is Prisma.ChamadoWhereInput => c !== null)
}

/**
 * Compara o `tipo` do chamado contra os prefixos de um escopo já resolvido.
 * Usada tanto pelo filtro de Prisma quanto pelas rotas de detalhe e de
 * encaminhamento — as três precisam concordar, senão um chamado aparece na
 * listagem e devolve 403 ao clicar nele.
 */
export function casaComPrefixos(tipo: string | null | undefined, prefixos: string[]): boolean {
  const tipoNorm = normTipo(tipo)
  if (!tipoNorm) return false
  return prefixos.some((p) => {
    const prefixo = normTipo(p)
    if (!prefixo) return false
    return tipoNorm === prefixo || tipoNorm.startsWith(`${prefixo} - `)
  })
}

/** Prefixos (`<categoria> - <opção>`) de um usuário com escopo. */
export async function prefixosDoUsuario(user: UsuarioComEscopo | null | undefined): Promise<string[]> {
  const tipos = tiposDoUsuario(user)
  if (!tipos.length) return []
  const nomes = await nomesDasCategorias(tipos.map((t) => t.chave))
  return tipos
    .map((t) => {
      const nome = nomes.get(t.chave)
      return nome ? prefixoDoTipo(nome, t.rotulo) : null
    })
    .filter((p): p is string => !!p)
}

/**
 * Este chamado está dentro do escopo do usuário?
 *
 * `true` quando o usuário NÃO tem escopo — quem decide aí é a unidade. É
 * por isso que a mesma função serve para "o técnico pode ver este chamado?" e
 * para "este técnico pode ser destino deste encaminhamento?".
 */
export async function casaComEscopo(
  chamado: { tipo?: string | null; categoriaChave?: string | null },
  user: UsuarioComEscopo | null | undefined,
): Promise<boolean> {
  const prefixos = await prefixosDoUsuario(user)
  if (!prefixos.length) return true
  return casaComPrefixos(chamado.tipo, prefixos)
}

/**
 * Filtra uma lista de candidatos (destinos de encaminhamento) pelo escopo de
 * cada um, resolvendo os nomes das categorias UMA vez.
 *
 * Existe em vez de repetir `casaComEscopo` no laço porque `tecnicosDaUnidade`
 * faz isso para todos os técnicos cadastrados — uma query por pessoa daria um
 * `formularioCategoria.findMany` por técnico.
 */
export async function filtrarPorEscopo<T>(
  chamado: { tipo?: string | null; categoriaChave?: string | null },
  candidatos: T[],
  usuarioDe: (c: T) => UsuarioComEscopo | null | undefined,
): Promise<T[]> {
  const chaves = new Set<string>()
  for (const c of candidatos) {
    for (const t of tiposDoUsuario(usuarioDe(c))) chaves.add(t.chave)
  }
  if (!chaves.size) return candidatos

  const nomes = await nomesDasCategorias([...chaves])
  return candidatos.filter((c) => {
    const tipos = tiposDoUsuario(usuarioDe(c))
    if (!tipos.length) return true // sem escopo: nunca é barrado
    const prefixos = tipos
      .map((t) => {
        const nome = nomes.get(t.chave)
        return nome ? prefixoDoTipo(nome, t.rotulo) : null
      })
      .filter((p): p is string => !!p)
    if (!prefixos.length) return false // escopo que não resolve: não atende
    return casaComPrefixos(chamado.tipo, prefixos)
  })
}