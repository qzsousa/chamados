/**
 * backfill-chamado-email.ts
 *
 * Recupera o e-mail dos chamados abertos ANTES de a consulta pública exigir o
 * par protocolo + e-mail. Sem esse campo, esses chamados nunca mais abrem no
 * site: o protocolo sozinho é sequencial e, por segurança, não abre nada.
 *
 * De onde sai o e-mail (nesta ordem de confiança):
 *   1. `descricao` com rótulo explícito — "Email: x@y" (formulário antigo) ou
 *      "[E-mail] x@y" (formulário por perguntas). Confiança ALTA.
 *   2. Qualquer e-mail solto na `descricao`/`historico`, se houver UM só.
 *      Confiança MÉDIA: pode ser o e-mail de outra pessoa citado no texto.
 *   3. Nada — fica de fora e vai para o relatório de revisão manual.
 *
 * NÃO existe fallback para o e-mail da escola (getEmailsContato): ele é
 * institucional, não do solicitante, e preencher com ele tornaria o chamado
 * legível por toda a escola. Use `--escola` só se quiser assumir esse
 * trade-off conscientemente.
 *
 * Uso:
 *   npx tsx backfill-chamado-email.ts                    -> dry-run (só relatório)
 *   npx tsx backfill-chamado-email.ts --apply            -> grava no banco
 *   npx tsx backfill-chamado-email.ts --escola           -> inclui o fallback da escola
 *   npx tsx backfill-chamado-email.ts --escola --abertos -> só os chamados em aberto
 *
 * Todo ajuste fica em backfill-chamado-email-<timestamp>.csv, para conferir e,
 * se precisar, reverter pelo protocolo.
 */
import { writeFileSync } from 'node:fs'
import { prisma } from './src/config/prisma'
import { getEmailsContato } from './src/services/normalization'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const usarEmailDaEscola = args.includes('--escola')
/** Só os chamados que ainda não foram resolvidos (recomendado com --escola). */
const soAbertos = args.includes('--abertos')

const REGEX_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

/**
 * Rótulos que os formulários gravaram na descrição logo antes do e-mail.
 * O grupo 1 é o trecho onde procuramos o endereço.
 */
const ROTULOS_EXPLICITOS: RegExp[] = [
  /e-?mail\s*:\s*([^\n\r|]+)/gi, // "Email: x@y"        (formulário antigo)
  /\[\s*e-?mail\s*\]\s*([^\n\r]+)/gi, // "[E-mail] x@y"     (formulário por perguntas)
]

type Origem = 'rotulo' | 'texto' | 'escola'

interface Recuperado {
  email: string
  origem: Origem
}

function emailsDo(texto: string | null | undefined): string[] {
  if (!texto) return []
  return (texto.match(REGEX_EMAIL) || []).map((e) => e.trim().toLowerCase())
}

/** E-mail do solicitante, se der para provar qual é. */
function recuperarEmail(c: { descricao: string | null; historico: string | null }): Recuperado | null {
  const texto = `${c.descricao || ''}\n${c.historico || ''}`

  // 1. Rótulo explícito: vence qualquer outra coisa, mesmo se o texto citar
  //    outros e-mails (o rótulo diz qual deles é o do solicitante).
  for (const re of ROTULOS_EXPLICITOS) {
    for (const m of texto.matchAll(new RegExp(re.source, re.flags))) {
      const achados = emailsDo(m[1])
      if (achados.length === 1) return { email: achados[0], origem: 'rotulo' }
    }
  }

  // 2. E-mail solto: só vale se for UM só; com dois ou mais não dá para saber
  //    de quem é o chamado, então deixa para decisão humana.
  const soltos = [...new Set(emailsDo(texto))]
  if (soltos.length === 1) return { email: soltos[0], origem: 'texto' }

  return null
}

/** Primeiro e-mail institucional da unidade (agrupado de escolas irmãs). */
function emailDaEscola(unidade: string): string | null {
  return getEmailsContato(unidade)[0]?.email ?? null
}

async function main() {
  console.log(
    [
      apply ? '▶ MODO APLICAR' : '▶ dry-run',
      usarEmailDaEscola ? 'com fallback do e-mail da escola' : 'sem fallback do e-mail da escola',
      soAbertos ? 'apenas chamados ainda em aberto' : 'incluindo chamados já resolvidos',
    ].join(' — ') + '\n'
  )

  const semEmail = { OR: [{ email: null }, { email: '' }] }
  const emAberto = { status: { in: ['ABERTO', 'ANDAMENTO', 'COMUNICADO'] } }

  const lista = await prisma.chamado.findMany({
    where: soAbertos ? { AND: [semEmail, emAberto] } : semEmail,
    orderBy: { protocolo: 'asc' },
    select: {
      id: true,
      protocolo: true,
      unidade: true,
      solicitante: true,
      descricao: true,
      historico: true,
      timestamp: true,
    },
  })

  if (!lista.length) {
    console.log('✅ Nenhum chamado sem e-mail no recorte. Nada a fazer.')
    return
  }

  const relatorio: Array<{ protocolo: string; email: string; origem: Origem }> = []
  const revisar: Array<{ protocolo: string; unidade: string; solicitante: string; motivo: string; sugestao: string }> = []
  let gravados = 0

  for (const c of lista) {
    let achado = recuperarEmail(c)

    if (!achado && usarEmailDaEscola) {
      const daEscola = emailDaEscola(c.unidade || '')
      if (daEscola) achado = { email: daEscola, origem: 'escola' }
    }

    if (achado) {
      // SQL cru, e não prisma.chamado.update: o update do Prisma faz RETURNING
      // de TODAS as colunas do model, então falha (P2022) enquanto o schema
      // local estiver à frente do banco — foi o que aconteceu com a coluna
      // `categoriaChave`, que ainda não está aplicada em produção. Escrevendo
      // só a coluna `email`, o backfill não depende do formato do schema.
      if (apply) {
        await prisma.$executeRaw`UPDATE "Chamado" SET "email" = ${achado.email} WHERE "id" = ${c.id}`
      }
      relatorio.push({ protocolo: c.protocolo, email: achado.email, origem: achado.origem })
      gravados++
      console.log(`${apply ? '✔' : '?'} ${c.protocolo} | ${c.unidade}  ==>  ${achado.email} (${achado.origem})`)
      continue
    }

    revisar.push({
      protocolo: c.protocolo,
      unidade: c.unidade,
      solicitante: c.solicitante,
      motivo: 'nenhum e-mail encontrado na descrição/histórico',
      sugestao: emailDaEscola(c.unidade || '') || '(escola fora da lista)',
    })
    console.log(`= ${c.protocolo} | ${c.unidade} | sem e-mail recuperável — revisão manual`)
    const trecho = (c.descricao || '').replace(/\s+/g, ' ').trim().slice(0, 90)
    if (trecho) console.log(`    descrição: ${trecho}…`)
  }

  const porOrigem = (o: Origem) => relatorio.filter((r) => r.origem === o).length

  // O CSV de ajustes só é gravado ao aplicar: em dry-run ele poluiria o repo
  // com um arquivo que não representa mudança nenhuma.
  if (apply && relatorio.length) {
    const arquivo = `backfill-chamado-email-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
    writeFileSync(
      arquivo,
      ['protocolo,email,origem', ...relatorio.map((r) => `${r.protocolo},${r.email},${r.origem}`)].join('\n'),
      'utf8'
    )
    console.log(`Relatório de ajustes: ${arquivo}`)
  }

  console.log(`\n${'─'.repeat(70)}`)
  console.log(`Sem e-mail no total : ${lista.length}`)
  console.log(
    `Recuperados         : ${relatorio.length} (${porOrigem('rotulo')} por rótulo, ${porOrigem('texto')} por texto${usarEmailDaEscola ? `, ${porOrigem('escola')} por escola` : ''})`
  )
  console.log(`Revisão manual      : ${revisar.length}`)
  console.log(`Gravados            : ${gravados} ${apply ? '(APLICADO)' : '(dry-run — rode com --apply para gravar)'}`)

  if (revisar.length) {
    console.log(`\nPrecisam de decisão humana (esses continuam sem consulta pública):`)
    for (const r of revisar) {
      console.log(`  ${r.protocolo} | ${r.unidade} | ${r.solicitante} | e-mail da escola: ${r.sugestao}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
