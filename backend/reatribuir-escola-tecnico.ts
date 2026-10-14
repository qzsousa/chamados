/**
 * Reatribui UMA escola de um técnico para outro, em todo o sistema.
 *
 * Mexe nos dois lugares onde o técnico mora, senão as telas discordam:
 *   1. `Escola.tecnico`   — quem é o técnico da escola (painéis de equipamento)
 *   2. `Usuario.filial`   — quais escolas o técnico atende (filtro de chamado)
 *
 * A lista oficial (`LISTA_ESCOLAS_TECNICOS` em `src/services/normalization`) é
 * o terceiro lugar: ela é corrigida no código, antes de rodar este script — o
 * script refuses to run if the code and the table disagree, because that means
 * someone fixed only one side.
 *
 *   npm run tecnicos:reatribuir -- "E.E. JARDIM IGUATEMI" GUILHERME VALDEIR
 *   npm run tecnicos:reatribuir -- "E.E. JARDIM IGUATEMI" GUILHERME VALDEIR --aplicar
 */
import 'dotenv/config'
import { prisma } from './src/config/prisma'
import { syncUsuarioParaSce } from './src/services/sceSync'
import { getMapaTecnicos, normalizarNomeEscola, NOMES_PADRONIZADOS } from './src/services/normalization'
import { SEPARADOR_UNIDADES, unidadesDoUsuario } from './src/services/unidades'

const args = process.argv.slice(2).filter((a) => a !== '--aplicar')
const APLICAR = process.argv.includes('--aplicar')
const [nomeEscola, para, de] = args

async function main() {
  if (!nomeEscola || !para) {
    console.error('Uso: npm run tecnicos:reatribuir -- "<escola>" <TECNICO_DESTINO> [TECNICO_ATUAL] [--aplicar]')
    process.exitCode = 1
    return
  }

  const chave = normalizarNomeEscola(nomeEscola)
  const oficial = NOMES_PADRONIZADOS.find((n) => normalizarNomeEscola(n) === chave)
  if (!oficial) {
    console.error(`❌ "${nomeEscola}" não está em NOMES_PADRONIZADOS — nada será gravado.`)
    process.exitCode = 1
    return
  }

  // Trava: a tabela Escola precisa concordar com o código antes do movimento.
  const mapa = getMapaTecnicos()
  if (mapa[chave] !== para) {
    console.error(
      `❌ No código a escola é de "${mapa[chave]}", você pediu "${para}".\n` +
        `   Corrija LISTA_ESCOLAS_TECNICOS em src/services/normalization antes de rodar.`,
    )
    process.exitCode = 1
    return
  }
  const escola = await prisma.escola.findUnique({ where: { nome: oficial }, select: { id: true, nome: true, tecnico: true } })
  if (!escola) {
    console.error(`❌ "${oficial}" não existe na tabela Escola — nada será gravado.`)
    process.exitCode = 1
    return
  }
  if (de && escola.tecnico !== de) {
    console.error(`❌ Na tabela Escola a escola é de "${escola.tecnico}", você esperava "${de}".`)
    process.exitCode = 1
    return
  }

  console.log(`${APLICAR ? '🔴 MODO APLICAÇÃO' : '🟡 DRY-RUN'}`)
  console.log(`\n${escola.nome}\n   ${escola.tecnico}  ->  ${para}\n`)

  // Reatribui a escola
  if (APLICAR) await prisma.escola.update({ where: { id: escola.id }, data: { tecnico: para } })
  console.log(`${APLICAR ? '✔' : '·'} Escola.tecnico = ${para}`)

  // Refaz o filial dos dois técnicos a partir da lista oficial
  for (const tecnico of new Set([para, escola.tecnico])) {
    const escolas = NOMES_PADRONIZADOS.filter((n) => mapa[normalizarNomeEscola(n)] === tecnico).sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    )
    const novoFilial = escolas.join(` ${SEPARADOR_UNIDADES} `)

    const alvo = normalizarNomeEscola(tecnico)
    const u = await prisma.usuario.findFirst({
      where: {
        OR: [
          { nome: { equals: tecnico, mode: 'insensitive' } },
          { email: { startsWith: `${alvo.toLowerCase().split(' ')[0]}@`, mode: 'insensitive' } },
        ],
      },
      select: { id: true, email: true, nome: true, nivel: true, filial: true },
    })

    if (!u) {
      console.log(`· ${tecnico}: sem usuário cadastrado (${escolas.length} escola(s) — nada a gravar)`)
      continue
    }

    const antes = unidadesDoUsuario(u.filial)
    const mudou = antes.length !== escolas.length || antes.some((e, i) => e !== escolas[i])
    console.log(`  ${mudou ? '↻' : '='} ${tecnico} <${u.email}> [${u.nivel}]: ${antes.length} -> ${escolas.length} escola(s)`)
    if (mudou && APLICAR) {
      await prisma.usuario.update({ where: { id: u.id }, data: { filial: novoFilial } })
      await syncUsuarioParaSce({ ...u, filial: novoFilial })
    }
  }

  console.log(APLICAR ? '\n✅ Reatribuído e reenviado ao SCE.' : '\n🟡 Nada gravado. Use --aplicar.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())