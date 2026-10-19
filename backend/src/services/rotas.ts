/**
 * Rotas que um usuário restrito pode alcançar.
 *
 * O `nivel` diz o que o usuário É (admin, gestor, técnico). Este módulo diz a
 * QUE PARTE do sistema ele chega — que é uma restrição independente: um
 * técnico pode ser de nível TECNICO e mesmo assim só poder ver /chamados.
 *
 * Onde isso é aplicado: no servidor, como 403. Esconder o item de menu no
 * portal é conveniência, não segurança — quem esconder-only ainda chama a API
 * direto e recebe 200.
 *
 * VAZIO = SEM RESTRIÇÃO, sempre. Os usuários que já existem no banco não têm
 * a coluna preenchida e continuam se comportando exatamente como antes.
 */
import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

/**
 * Domínio do sistema -> prefixo da API que o serve.
 *
 * A chave é a mesma que o portal usa para identificar a tela, para o menu e o
 * guard de rota do lado do cliente e o middleware daqui contarem a mesma
 * lista. Mudar uma chave aqui e no router do portal junto.
 */
export const PREFIXO_POR_ROTA: Record<string, string> = {
  chamados: '/api/chamados',
  equipamentos: '/api/equipamentos',
  dashboard: '/api/dashboard',
  usuarios: '/api/usuarios',
  escolas: '/api/escolas',
  agenda: '/api/agenda',
  inventario: '/api/inventario',
  dvr: '/api/dvr',
  tutoriais: '/api/tutoriais',
  encaminhamentos: '/api/encaminhamentos',
  notificacoes: '/api/notificacoes',
  formulario: '/api/formulario',
  feedback: '/api/feedback'
}

/**
 * Rotas que nunca são bloqueadas por restrição de usuário.
 *
 * `/api/auth` é a sessão: login, refresh, logout e troca de senha. Bloquear
 * qualquer uma delas deixaria o usuário preso sem conseguir nem sair — e sem
 * conseguir trocar a senha, que é justamente o que o fluxo de primeiro acesso
 * exige.
 */
export const ROTAS_LIVRES = ['/api/auth']

const PREFIXOS = Object.entries(PREFIXO_POR_ROTA).sort((a, b) => b[1].length - a[1].length)

/** O usuário tem restrição de rota? (lista vazia = não tem) */
export function temRestricaoDeRota(user: { rotasPermitidas?: string[] } | undefined | null): boolean {
  return (user?.rotasPermitidas?.length ?? 0) > 0
}

/** Domínio a que um path da API pertence, ou null se não mapeado. */
export function dominioDaRota(path: string): string | null {
  const hit = PREFIXOS.find(([, prefixo]) => path === prefixo || path.startsWith(`${prefixo}/`))
  return hit ? hit[0] : null
}

/** A rota é de sessão (auth)? Essas nunca são bloqueadas. */
export function rotaLivre(path: string): boolean {
  return ROTAS_LIVRES.some((p) => path === p || path.startsWith(`${p}/`))
}

/**
 * O usuário pode alcançar este path?
 *
 * Sem restrição, sempre pode. Com restrição, só os domínios listados.
 */
export function podeAcessarRota(
  user: { rotasPermitidas?: string[] } | undefined | null,
  path: string
): boolean {
  if (!temRestricaoDeRota(user)) return true
  if (rotaLivre(path)) return true
  // Os cartões de KPI do /chamados vêm de /api/dashboard/stats — a tela que o
  // usuário PODE ver depende dela, mesmo sem ter a rota "dashboard" liberada.
  // Tratar esse endpoint como parte do domínio "chamados" evita KPI em branco
  // (… ) para usuários restritos sem abrir o resto do painel.
  const caminhoLimpo = path.split('?')[0]
  if (caminhoLimpo === '/api/dashboard/stats' || caminhoLimpo.startsWith('/api/dashboard/stats/')) {
    const permitidas = user?.rotasPermitidas ?? []
    return permitidas.includes('chamados') || permitidas.includes('dashboard')
  }
  const dominio = dominioDaRota(path)
  if (!dominio) return false // rota desconhecida e usuário restrito: fechado por padrão
  return (user?.rotasPermitidas ?? []).includes(dominio)
}

/**
 * Middleware da parede de auth: bloqueia a rota antes do handler.
 *
 * Devolve 403 e não 404 de propósito — quem recebe o 403 é um usuário
 * autenticado e legítimosic, e a resposta precisa dizer que o acesso é
 * proibido, para o portal conseguir distinguir "você não pode" de "não
 * existe".
 */
export function exigirRotaPermitida(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const user = req.userRecord
  if (!user) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Usuário não autenticado' })
    return
  }
  // `baseUrl` aqui é só o prefixo do mount (`/api`), não o caminho pedido —
  // com ele, toda rota pareceria a mesma e o `/api/auth` de sessão seria
  // barrado. O caminho real vem em `originalUrl`, sem a query string.
  const caminho = req.originalUrl.split('?')[0]
  if (podeAcessarRota(user, caminho)) {
    next()
    return
  }
  res.status(403).json({
    error: 'FORBIDDEN',
    message: 'Seu acesso é restrito a outros recursos'
  })
}

/** Rotas que existem no catálogo — para validar o que o ADMIN pode gravar. */
export function rotaConhecida(dominio: string): boolean {
  return Object.prototype.hasOwnProperty.call(PREFIXO_POR_ROTA, dominio)
}
