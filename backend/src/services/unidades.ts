/**
 * Unidades de um usuário.
 *
 * O campo `Usuario.filial` guarda UMA unidade para gestor/visualizador e uma
 * LISTA separada por vírgula para o técnico (ele atende várias escolas) — ex.:
 * "E.E. BELIZE, E.E. JARDIM IGUATEMI". Todo filtro por unidade precisa passar
 * por aqui, senão o técnico de várias unidades não enxerga nada.
 *
 * Este módulo é a fonte única do casamento de unidade entre usuário e chamado;
 * os filtros de Prisma e as comparações em memória usam as mesmas funções.
 */

/**
 * Separador entre as unidades do técnico em `Usuario.filial`.
 *
 * A vírgula NÃO serve: três escolas oficiais têm vírgula no NOME
 * ("E.E. BRENO ROSSI, MAESTRO", "E.E. FERNANDO MAURO P. ROCHA, DEPUTADO",
 * "E.E. GERALDINO DOS SANTOS, DEPUTADO / JOSUÉ DE CASTRO"). Quebrando por ela,
 * "E.E. FERNANDO MAURO P. ROCHA, DEPUTADO" virava dois tokens — e o token solto
 * "DEPUTADO" casava também com a escola do técnico vizinho, que terminava em
 * ", DEPUTADO". No SCE o efeito era o oposto: o casamento é por igualdade, então
 * nenhuma das três achava o próprio parque.
 *
 * A vírgula continua sendo aceita porque já está gravada em vários usuários:
 * quem tem "|" usa "|" e quem tem "," continua com "," — a lista nunca é misturada.
 */
export const SEPARADOR_UNIDADES = '|'

/** Normaliza nome de unidade para comparação (sem acento, sem "E.E.", sem honorífico). */
export function normalizarUnidade(valor: string | null | undefined): string {
  let n = String(valor || '')
    .toUpperCase()
    .replace(/^E\.?E\.?\s*/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  n = n.replace(/(\s+(PROF(A)?|DR(A)?|DEPUTAD[OA]|PRESIDENTE|MAESTRO))+\s*$/, '').trim()
  return n
}

/** Lista de unidades do usuário (filial única vira lista de um item). */
export function unidadesDoUsuario(filial: string | null | undefined): string[] {
  const bruto = String(filial || '')
  // "|" manda: com ele presente a vírgula é parte do nome da escola, não separador.
  const partes = bruto.includes(SEPARADOR_UNIDADES) ? bruto.split(SEPARADOR_UNIDADES) : bruto.split(',')
  return partes.map((u) => u.trim()).filter((u) => u.length > 0)
}

/**
 * `unidade` casa com alguma unidade do usuário? Tolera:</br>
 * - diferença de acento/maiúsculas/"E.E."</br>
 * - escolas irmãs: "E.E. A / E.E. B" casa com quem tem "E.E. A" (e vice-versa)
 * - sufixos honoríficos no fim do nome
 */
export function usuarioAtendeUnidade(
  filial: string | null | undefined,
  unidade: string | null | undefined,
): boolean {
  const alvo = normalizarUnidade(unidade)
  if (!alvo) return false
  return unidadesDoUsuario(filial).some((u) => {
    if (u === unidade) return true
    const n = normalizarUnidade(u)
    if (!n) return false
    if (n === alvo) return true
    if (n.length > 3 && alvo.includes(n)) return true
    if (alvo.length > 3 && n.includes(alvo)) return true
    // grupo composto: casa com a parte já normalizada
    return u
      .split('/')
      .some((p) => {
        const pn = normalizarUnidade(p)
        return pn.length > 3 && (alvo.includes(pn) || pn.includes(alvo))
      })
  })
}

/** Prisma `where` que casa um chamado com QUALQUER unidade do usuário. */
export function filtroUnidadesDoUsuario(filial: string | null | undefined) {
  const unidades = unidadesDoUsuario(filial)
  if (!unidades.length) return { OR: [{ unidade: { equals: '__sem_unidades__' } }] }
  return {
    OR: unidades.map((u) => ({ unidade: { contains: normalizarUnidade(u) || u, mode: 'insensitive' as const } })),
  }
}
