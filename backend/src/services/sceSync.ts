import { env } from '../config/env'
import { grupoDaUnidade, papelDaUnidade } from './normalization'
import { SEPARADOR_UNIDADES, unidadesDoUsuario } from './unidades'

/**
 * `Usuario.filial` na forma que o SCE entende.
 *
 * Cada unidade da lista é resolvida para o SEU grupo antes de ir — é o que faz
 * o técnico de uma escola irmã enxergar o parque do prédio compartilhado. Fazer
 * isso na lista inteira não funciona: "E.E. LEILA DINIZ | E.E. VILA BELA" não
 * existe no catálogo, `grupoDaUnidade` devolveria a string sem resolver nada e
 * o técnico perderia o acesso às duas escolas.
 *
 * Sai sempre com "|", que é o separador que nenhuma escola oficial tem no nome.
 */
export function filialParaSce(filial: string | null | undefined): string {
  const unidades = unidadesDoUsuario(filial)
  if (!unidades.length) return ''
  return unidades.map((u) => grupoDaUnidade(u)).join(` ${SEPARADOR_UNIDADES} `)
}

/**
 * Papel MAE/FILHA do técnico.
 *
 * Só faz sentido para quem atende UMA escola: quando a lista tem várias, não há
 * um par de irmãs único para classificar, e o SCE trata "sem papel" como
 * leitura do grupo inteiro — que é o comportamento certo de um técnico.
 */
function papelParaSce(filial: string | null | undefined): 'MAE' | 'FILHA' | null {
  const unidades = unidadesDoUsuario(filial)
  if (unidades.length !== 1) return null
  return papelDaUnidade(unidades[0])
}

/**
 * Sincroniza um usuário do sistema de chamados para o SCE (equipamentos).
 * O SCE mantém sua própria tabela `usuarios` como autoridade local de
 * nível/filial, resolvendo o usuário pelo e-mail (SSO do portal).
 *
 * Escolas irmãs (mesmo prédio, ex.: "E.E. A / E.E. B") têm usuários
 * INDIVIDUAIS aqui, mas compartilham o mesmo painel de equipamentos: por isso
 * a filial enviada ao SCE é o nome do GRUPO (composto). O SCE casa o acesso
 * de forma tolerante (partes do composto, sem "E.E."/honoríficos).
 *
 * Além do grupo, enviamos `papelUnidade` (MAE/FILHA): como o SCE só enxerga o
 * grupo, é essa informação que faz a escola FILHA ter acesso somente de
 * leitura aos equipamentos (nada de criar/editar/remover).
 *
 * Nunca lança erro — falhas são apenas logadas (o sync será feito de novo
 * na próxima edição do usuário ou pela reconciliação em lote).
 */
export async function syncUsuarioParaSce(usuario: {
  email: string
  nome: string
  nivel: string
  filial: string
  status: string
}): Promise<void> {
  if (!env.SCE_API_URL || !env.SCE_SYNC_KEY) return

  const filialGrupo = filialParaSce(usuario.filial)
  const papelUnidade = papelParaSce(usuario.filial)

  try {
    const res = await fetch(`${env.SCE_API_URL}/api/internal/sync-usuario`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-key': env.SCE_SYNC_KEY,
      },
      body: JSON.stringify({
        email: usuario.email.toLowerCase(),
        nome: usuario.nome,
        nivel: usuario.nivel,
        filial: filialGrupo,
        papelUnidade,
        status: usuario.status,
      }),
    })

    if (!res.ok && res.status !== 200) {
      const body = await res.text().catch(() => '')
      console.warn(`[sceSync] resposta inesperada (${res.status}) para ${usuario.email}: ${body.slice(0, 200)}`)
    }
  } catch (err) {
    console.warn(`[sceSync] falha ao chamar SCE para ${usuario.email}:`, err)
  }
}
