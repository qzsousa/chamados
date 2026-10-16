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
 *
 * A EXCEÇÃO À REGRA DA LISTA VAZIA
 *
 * "Lista vazia = sem restrição" vale para VER chamado. Para RECEBER, não:
 * nas categorias de `CATEGORIAS_COM_LIBERACAO` (Sistemas e E-mail) a lista
 * vazia significa "não está liberado para esse assunto". Ver `podeReceberChamado`.
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
export async function clauseDeEscopo(escopo: string[]): Promise<Prisma.ChamadoWhereInput | null> {
  const tipos = escopo.map(quebrarEscopo).filter((t): t is TipoEscopo => t !== null)
  if (!tipos.length) return null
  const nomes = await nomesDasCategorias(tipos.map((t) => t.chave))

  const alternativas: Prisma.ChamadoWhereInput[] = []
  for (const t of tipos) {
    const nome = nomes.get(t.chave)
    if (!nome) continue // categoria desconhecida: não há com o que casar
    const prefixo = prefixoDoTipo(nome, t.rotulo)
    if (!prefixo) continue
    alternativas.push({
      OR: [
        { tipo: { equals: prefixo, mode: 'insensitive' as const } },
        { tipo: { startsWith: `${prefixo} - `, mode: 'insensitive' as const } },
      ],
    })
  }

  if (!alternativas.length) return null
  // As opções do escopo são ALTERNATIVAS entre si: quem tem "SEI" e "PortalNet"
  // atende os dois, não exige que o chamado seja os dois ao mesmo tempo.
  return { OR: alternativas }
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
 *
 * NÃO usar para decidir DESTINO: lá a ausência de escopo deixa de significar
 * "atende tudo" nas categorias de `CATEGORIAS_COM_LIBERACAO`, e quem sabe
 * disso é `podeReceberChamado`.
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
 * Categorias que SÓ são encaminhadas a quem as liberou no perfil.
 *
 * Sistemas e E-mail são as de fila curta e trabalho especializado: o volume é
 * pequeno e o atendimento é de quem conhece o assunto. Para o resto a regra de
 * sempre continua valendo — lista vazia é sem restrição e quem decide é a
 * unidade —, mas nelas a lista vazia passa a significar "não atende".
 *
 * Sem essa ressalva, qualquer volante que atendesse a escola recebia chamado
 * de sistema junto com o de rede. A escala da equipe tentava impedir isso, mas
 * vivia só na tela do portal: o encaminhamento — automático ou manual — não
 * olhava o perfil, e era por lá que o chamado entrava.
 *
 * São as chaves de `FormularioCategoria.chave`. `e-mail` entra para cobrir a
 * grafia com hífen de quem cadastrou a categoria assim.
 */
export const CATEGORIAS_COM_LIBERACAO = ['sistemas', 'email', 'e-mail']

/**
 * Maiúscula e sem acento: a chave sai de um slug, mas o cadastro da categoria
 * é manual e as duas grafias existem no formulário.
 */
function normChave(valor: string | null | undefined): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

const LIBERACAO_NORM = new Set(CATEGORIAS_COM_LIBERACAO.map(normChave))

/** Esta categoria só chega a quem a marcou no perfil? */
export function categoriaExigeLiberacao(chave: string | null | undefined): boolean {
  return LIBERACAO_NORM.has(normChave(chave))
}

/**
 * Chave da categoria do chamado.
 *
 * A chave é gravada na criação, mas só nos chamados abertos depois que o
 * formulário passou a ter chave — nos anteriores vem `null`. Nesses a
 * categoria é descoberta pelo nome com que o `tipo` começa, que é a mesma
 * aposta de `casaComRegra` no encaminhamento: o `tipo` é `<categoria> - <1ª
 * resposta>`, e o " - " evita que "Equip. - Sistema" caia em Sistemas.
 *
 * A consulta só acontece no caminho dos chamados antigos, que param de
 * gravar a chave a cada dia.
 */
export async function chaveDaCategoria(chamado: {
  tipo?: string | null
  categoriaChave?: string | null
}): Promise<string> {
  const chave = String(chamado.categoriaChave || '').trim()
  if (chave) return chave

  const tipo = normTipo(chamado.tipo)
  if (!tipo) return ''
  const categorias = await prisma.formularioCategoria.findMany({
    select: { chave: true, nome: true },
  })
  return (
    categorias.find((c) => {
      const nome = normTipo(c.nome)
      return !!nome && (tipo === nome || tipo.startsWith(`${nome} - `))
    })?.chave ?? ''
  )
}

/** Este chamado está numa categoria que exige liberação no perfil do técnico? */
export async function exigeLiberacao(chamado: {
  tipo?: string | null
  categoriaChave?: string | null
}): Promise<boolean> {
  return categoriaExigeLiberacao(await chaveDaCategoria(chamado))
}

/** O usuário liberou ESTA categoria no perfil (qualquer um dos tipos dela)? */
export function liberouCategoria(
  user: UsuarioComEscopo | null | undefined,
  chave: string | null | undefined,
): boolean {
  const alvo = normChave(chave)
  if (!alvo) return false
  return tiposDoUsuario(user).some((t) => normChave(t.chave) === alvo)
}

/**
 * Este técnico pode receber este chamado?
 *
 * `casaComEscopo` pergunta "o tipo está no escopo da pessoa?" e responde `true`
 * para quem não tem escopo. Aqui entra a ressalva das categorias com
 * liberação: nelas a ausência de escopo é "não atende esta categoria", e não
 * "atende tudo". É a diferença entre quem atende a escola e quem foi
 * habilitado naquele assunto — e só a segunda entra na fila.
 *
 * `liberadaJaResolvida` evita resolver a categoria duas vezes: quem chama
 * para muitos candidatos resolve uma vez e repassa o resultado.
 */
export async function podeReceberChamado(
  chamado: { tipo?: string | null; categoriaChave?: string | null },
  user: UsuarioComEscopo | null | undefined,
  liberadaJaResolvida?: boolean,
): Promise<boolean> {
  const liberada = liberadaJaResolvida ?? (await exigeLiberacao(chamado))
  if (liberada && !temEscopo(user)) return false
  return casaComEscopo(chamado, user)
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
  const liberada = await exigeLiberacao(chamado)
  const chaves = new Set<string>()
  for (const c of candidatos) {
    for (const t of tiposDoUsuario(usuarioDe(c))) chaves.add(t.chave)
  }
  // Ninguém com escopo: o filtro só tem o que dizer se a categoria exigir
  // liberação, e aí a resposta é "ninguém" — a lista de quem não atendeu não
  // libera ninguém. Sem liberação, sai como está, como sempre.
  if (!chaves.size) return liberada ? [] : candidatos

  const nomes = await nomesDasCategorias([...chaves])
  return candidatos.filter((c) => {
    const tipos = tiposDoUsuario(usuarioDe(c))
    if (!tipos.length) return !liberada
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