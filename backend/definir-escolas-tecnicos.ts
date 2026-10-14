/**
 * Define as escolas de cada TÉCNICO em `Usuario.filial`.
 *
 * O problema: os sete usuários de nível TECNICO estão com `filial = "A DEFINIR"`,
 * então nenhum técnico enxerga chamado nenhum — o filtro por unidade não acha
 * nada para casar. A distribuição escola→técnico nunca chegou ao usuário.
 *
 * De onde vem a lista
 * ------------------
 * A lista é montada da `LISTA_ESCOLAS_TECNICOS` de `src/services/normalization`,
 * já na grafia de `NOMES_PADRONIZADOS` — que é a grafia que o SCE resolve. A
 * tabela `Escola` entra como CONFERÊNCIA, não como fonte: se as duas divergirem
 * na escala técnica, o técnico ficaria com as escolas do colega.
 *
 * Grafia
 * ------
 * A lista é gravada separada por "|" — ver `SEPARADOR_UNIDADES`: a vírgula é
 * parte do nome de três escolas oficiais e quebrava a lista no meio.
 *
 * Quem é o quê
 * ------------
 * O técnico é identificado pelo NOME (`Usuario.nome` ou a parte antes do "@"),
 * sem acento: o cadastro usa "Joao" e a lista usa "JOÃO". Se o nome casar com
 * mais de um usuário o script aborta em vez de escolher — técnico errado com
 * acesso errado é pior do que técnico sem acesso.
 *
 * O ADMIN que também é técnico (FABIO) recebe a lista do mesmo jeito: o nível
 * ADMIN não filtra por unidade, então ele não perde nada, e o SCE mapeia ADMIN
 * para MATRIZ. A lista registra a área dele.
 *
 * Uso:
 *   npm run tecnicos:escolas                # dry-run (só relatório)
 *   npm run tecnicos:escolas -- --aplicar    # grava e reenvia ao SCE
 */
import 'dotenv/config'
import { prisma } from './src/config/prisma'
import { syncUsuarioParaSce } from './src/services/sceSync'
import { getMapaTecnicos, normalizarNomeEscola, NOMES_PADRONIZADOS } from './src/services/normalization'
import { SEPARADOR_UNIDADES, unidadesDoUsuario } from './src/services/unidades'

const APLICAR = process.argv.includes('--aplicar')

/**PARTÍCIPAS em comum entre dois nomes normalizados (0..1). */
function sobreposicaoDeTokens(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter(Boolean))
  const tb = new Set(b.split(' ').filter(Boolean))
  if (!ta.size || !tb.size) return 0
  let comuns = 0
  for (const t of ta) if (tb.has(t)) comuns += 1
  return comuns / Math.min(ta.size, tb.size)
}

async function main() {
  console.log(
    APLICAR
      ? '🔴 MODO APLICAÇÃO — vai gravar no banco.\n'
      : '🟡 DRY-RUN — nada será gravado. Use --aplicar para gravar.\n',
  )

  // 1) Mapa da lista oficial: normalizada -> { nome oficial, técnico }.
  const mapaTecnicos = getMapaTecnicos()
  const listaFinal = new Map<string, string[]>()
  const conflitoDeTecnico: string[] = []

  for (const nome of NOMES_PADRONIZADOS) {
    const t = mapaTecnicos[normalizarNomeEscola(nome)]
    if (!t) continue
    if (!listaFinal.has(t)) listaFinal.set(t, [])
    listaFinal.get(t)!.push(nome)
  }
  for (const t of listaFinal.keys()) listaFinal.set(t, listaFinal.get(t)!.sort((a, b) => a.localeCompare(b, 'pt-BR')))

  if (!listaFinal.size) {
    console.error('❌ A lista oficial ficou vazia — nada será gravado.')
    process.exitCode = 1
    return
  }

  // 2) Conferência contra a tabela Escola.
  const escolas = await prisma.escola.findMany({
    select: { nome: true, tecnico: true },
    orderBy: { nome: 'asc' },
  })

  const doBanco = new Map<string, { nome: string; tecnico: string }>()
  for (const e of escolas) doBanco.set(normalizarNomeEscola(e.nome), { nome: e.nome, tecnico: e.tecnico })

  const grafiaDivergente: string[] = []
  const foraDoCodigo: string[] = []
  const codigoSemBanco: string[] = []

  for (const [chave, oficial] of doBanco) {
    const t = mapaTecnicos[chave]
    if (!t) {
      // Escola que a lista oficial não cobre (ex.: a escola de teste do seed).
      foraDoCodigo.push(`${oficial.nome} (técnico no banco: ${oficial.tecnico || '—'})`)
      continue
    }
    if (oficial.tecnico && oficial.tecnico !== t) {
      conflitoDeTecnico.push(`"${oficial.nome}": banco = ${oficial.tecnico}, lista = ${t}`)
    }
  }

  for (const [t, lista] of listaFinal) {
    for (const nome of lista) {
      const chave = normalizarNomeEscola(nome)
      if (doBanco.has(chave)) continue
      codigoSemBanco.push(`${t} — "${nome}"`)
      // Grafia quase igual no banco? Aponto onde procurar.
      let melhor: { nome: string; score: number } | null = null
      for (const [chave, e] of doBanco) {
        const s = sobreposicaoDeTokens(chave, normalizarNomeEscola(nome))
        if (s >= 0.75 && (!melhor || s > melhor.score)) melhor = { nome: e.nome, score: s }
      }
      if (melhor) grafiaDivergente.push(`"${nome}" (lista)  ≈  "${melhor.nome}" (banco)`)
    }
  }

  if (conflitoDeTecnico.length) {
    console.error('❌ A mesma escola com técnicos diferentes na lista e no banco — nada será gravado:')
    for (const c of conflitoDeTecnico) console.error(`   ${c}`)
    console.error('\n   Alguém corrigiu um lado só. Reconcilie antes de rodar de novo.')
    process.exitCode = 1
    return
  }

  const totalEscolas = new Set([...listaFinal.values()].flat()).size
  console.log(`✔ lista oficial: ${totalEscolas} escola(s) em ${listaFinal.size} técnico(s)`)
  console.log(`✔ banco: ${escolas.length} escola(s) — nenhum conflito de técnico\n`)

  if (grafiaDivergente.length) {
    console.log('⚠  GRAFIA DIVERGENTE (mesma escola, escrita diferente nos dois lados):')
    for (const g of grafiaDivergente) console.log(`   ${g}`)
    console.log('   A lista vai gravada com a grafia da NOMES_PADRONIZADOS, que é a que o SCE resolve.')
    console.log('   A tabela Escola continua com a grafia antiga — é um ajuste à parte.\n')
  }
  if (codigoSemBanco.length) {
    console.log('⚠  Na lista oficial e sem o nome exato na tabela Escola:')
    for (const g of codigoSemBanco) console.log(`   ${g}`)
    console.log('')
  }
  if (foraDoCodigo.length) {
    console.log('ℹ  Escolas no banco que a lista oficial não cobre (ignoradas):')
    for (const g of foraDoCodigo) console.log(`   ${g}`)
    console.log('')
  }

  // 3) Casa cada técnico com o usuário. Ambiguidade aborta.
  const usuarios = await prisma.usuario.findMany({
    select: { id: true, email: true, nome: true, nivel: true, filial: true, status: true },
    orderBy: { email: 'asc' },
  })

  interface Alvo {
    usuario: (typeof usuarios)[number]
    tecnico: string
    escolas: string[]
    novoFilial: string
  }

  const alvos: Alvo[] = []
  const ambiguos: string[] = []
  const semCorrespondencia: string[] = []

  for (const [tecnico, lista] of [...listaFinal].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))) {
    const alvo = normalizarNomeEscola(tecnico).trim()
    const candidatos = usuarios.filter((u) => {
      const local = String(u.email).split('@')[0] ?? ''
      return normalizarNomeEscola(u.nome) === alvo || normalizarNomeEscola(local) === alvo
    })

    if (!candidatos.length) {
      semCorrespondencia.push(tecnico)
      continue
    }
    if (candidatos.length > 1) {
      ambiguos.push(`${tecnico}: ${candidatos.map((c) => `${c.nome} <${c.email}>`).join(' e ')}`)
      continue
    }

    const usuario = candidatos[0]
    alvos.push({
      usuario,
      tecnico,
      escolas: lista,
      novoFilial: lista.join(` ${SEPARADOR_UNIDADES} `),
    })
  }

  if (ambiguos.length) {
    console.error('❌ Mais de um usuário com o mesmo nome de técnico — nada será gravado:')
    for (const a of ambiguos) console.error(`   ${a}`)
    process.exitCode = 1
    return
  }

  // 4) Relatório
  console.log('── O QUE VAI MUDAR ──────────────────────────────────────────\n')
  for (const a of alvos) {
    console.log(
      `  ${a.tecnico}  (${a.escolas.length} escola${a.escolas.length === 1 ? '' : 's'})  ` +
        `<${a.usuario.email}>  [${a.usuario.nivel}/${a.usuario.status}]`,
    )
    if (a.usuario.nivel !== 'TECNICO') {
      console.log(`     ℹ  nível ${a.usuario.nivel}: a lista não restringe o acesso dele, só registra a área.`)
    }
    console.log(`     de: ${JSON.stringify(a.usuario.filial)}`)
    for (const e of a.escolas) console.log(`       · ${e}`)
    console.log('')
  }

  if (semCorrespondencia.length) {
    console.log('── SEM USUÁRIO CADASTRADO (as escolas ficariam sem dono) ──')
    for (const t of semCorrespondencia) {
      console.log(`  ${t} — ${listaFinal.get(t)!.length} escola(s): ${listaFinal.get(t)!.join(', ')}`)
    }
  }

  const inalterados = alvos.filter((a) => a.usuario.filial === a.novoFilial)
  if (inalterados.length) {
    console.log(`\n✔ ${inalterados.length} já estão no lugar (o script é idempotente).`)
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(
    `Total: ${alvos.length} usuário(s), ${new Set(alvos.flatMap((a) => a.escolas)).size} escola(s) definidas.`,
  )

  if (!APLICAR) {
    console.log('\n🟡 Nada gravado. Rode com --aplicar para gravar e reenviar ao SCE.\n')
    return
  }

  console.log('\n── GRAVANDO ─────────────────────────────────────────────────\n')
  let ok = 0
  let falhas = 0

  for (const a of alvos) {
    try {
      await prisma.usuario.update({ where: { id: a.usuario.id }, data: { filial: a.novoFilial } })
      await syncUsuarioParaSce({ ...a.usuario, filial: a.novoFilial })
      ok += 1
      console.log(`  ✔ ${a.usuario.email} — ${a.escolas.length} escola(s)`)
    } catch (e) {
      falhas += 1
      console.error(`  ❌ ${a.usuario.email}: ${e instanceof Error ? e.message : e}`)
    }
  }

  console.log(`\n${ok} atualizado(s) no portal e reenviado(s) ao SCE.`)
  if (semCorrespondencia.length) {
    console.log(
      `⚠  ${semCorrespondencia.length} técnico(s) continuam sem usuário: ${semCorrespondencia.join(', ')}`,
    )
  }
  if (falhas) {
    console.log(`❌ ${falhas} falha(s). Rode de novo — o script é idempotente.`)
    process.exitCode = 1
  } else {
    console.log('✅ Escolas dos técnicos definidas!')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())