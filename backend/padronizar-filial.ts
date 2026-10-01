/**
 * Padroniza `Usuario.filial` para o nome OFICIAL da escola.
 *
 * O problema: `equipamentos.unidade` e `filiais` (SCE) já usam o nome oficial,
 * mas `Usuario.filial` ficou com a grafia antiga do cadastro do Google Sheets.
 * Como o SCE resolve o acesso pelo `filial` da própria tabela `usuarios`
 * (via SSO, `server.js` -> `trySsoSession`), o matcher `unidadesCasam` não
 * encontra a escola e o usuário entra no painel vendo ZERO equipamentos —
 * mesmo com o parque inteiro cadastrado.
 *
 * Cada par abaixo foi conferido individualmente: a escola existe em `filiais`,
 * tem equipamentos, e a grafia antiga NÃO casa com a oficial. O par é validado
 * contra `NOMES_PADRONIZADOS` antes de qualquer escrita.
 *
 * Só o par EXATO é trocado — nunca por substring — para não mexer nos grupos
 * de escolas irmãs ("A, B") nem em nomes que por acaso contêm o texto.
 *
 * Uso:
 *   npm run filial:padronizar              # dry-run (só relatório)
 *   npm run filial:padronizar -- --aplicar  # grava no portal e ressincroniza o SCE
 */
import 'dotenv/config'
import { prisma } from './src/config/prisma'
import { syncUsuarioParaSce } from './src/services/sceSync'
import { grupoDaUnidade, papelDaUnidade, NOMES_PADRONIZADOS } from './src/services/normalization'

/** Grafia antiga (em `Usuario.filial`) -> nome oficial (em `filiais`). */
const CORRECOES: Array<{ de: string; para: string; nota: string }> = [
  {
    de: 'Francisco De Assis Pires Correa Prof',
    para: 'E.E. FRANCISCO DE ASSIS P. CORRÊA',
    nota: '344 equipamentos',
  },
  {
    de: 'Sebastiao Faria Zimbres Prof',
    para: 'E.E. SEBASTIÃO FARIAS ZIMBRES',
    nota: '300 equipamentos',
  },
  {
    de: 'Fernando Mauro Pires Da Rocha Deputado',
    para: 'E.E. FERNANDO MAURO P. ROCHA, DEPUTADO',
    nota: '199 equipamentos',
  },
  {
    de: 'Zipora Rubinstein Profa',
    para: 'E.E. ZÍPORA RUBISTEIN',
    nota: '161 equipamentos (3 usuários)',
  },
  { de: 'Conjunto Habitacional Itaquera IV', para: 'E.E. COHAB ITAQUERA IV', nota: '95 equipamentos' },
  { de: 'Escritor Juan Onetti', para: 'E.E. JUAN CARLOS ONETTI', nota: '78 equipamentos' },
  {
    de: 'Candido Procopio Ferreira De Camargo Prof',
    para: 'E.E. CÂNDIDO PROCÓPIO F. CAMARGO',
    nota: '27 equipamentos',
  },
  {
    de: 'Maria De Lourdes Aranha De Assis Pacheco Profa',
    para: 'E.E. MARIA DE LOURDES A. A. PACHECO / CHIQUINHA GONZAGA',
    nota: '20 equipamentos (2 usuários)',
  },
  { de: 'Ernestina Del Buono Trama Profa', para: 'E.E. ERNESTINA DEL B. TRAMA', nota: '15 equipamentos (2 usuários)' },
  { de: 'Sergio Estanislau Camargo', para: 'E.E. SERGIO ESTANISTLAU DE CAMARGO', nota: '3 equipamentos' },

  // Indiana: o equipamento também foi migrado no SCE (unidades-migrar-oficial.js).
  // Sem trocar o usuário junto, os 3 ficariam sem acesso.
  { de: 'Indiana Zuycher Simoes De Jesus Profa', para: 'E.E. INDIANA ZUYCHER S. DE JESUS', nota: '19 equipamentos (3 usuários)' },

  // Grafias que já casam hoje (a coluna de equipamento do SCE ainda usa a
  // grafia antiga). Trocar é cosmético: o acesso não muda.
  { de: 'Luiz Vaz De Camoes', para: 'E.E. LUIZ VAZ DE CAMÕES', nota: '200 equipamentos' },
  { de: 'Isaac Schraiber Prof', para: 'E.E. ISAAC SCHRAIBER', nota: '239 equipamentos' },
  { de: 'Mozart Tavares De Lima Prof', para: 'E.E. MOZART TAVARES DE LIMA', nota: '11 equipamentos' },
  { de: 'Ruy De Mello Junqueira', para: 'E.E. RUY DE MELLO JUNQUEIRA', nota: '8 equipamentos' },
  { de: 'Joaquim Silverio Gomes Dos Reis Prof', para: 'E.E. JOAQUIM SILVÉRIO G. DOS REIS', nota: 'sem parque cadastrado' },
  { de: 'Brenno Rossi Maestro', para: 'E.E. BRENO ROSSI, MAESTRO', nota: 'sem parque cadastrado' },
  { de: 'Conjunto Habitacional Carraozinho', para: 'E.E. COHAB CARRÃOZINHO', nota: 'sem parque cadastrado' },
  { de: 'Recanto Verde Sol', para: 'E.E. RECANTO VERDE SOL / DJANIRA', nota: 'sem parque cadastrado' },
  { de: 'Fadlo Haidar', para: 'E.E. FADLO HAIDAR', nota: 'sem parque cadastrado' },
]

const APLICAR = process.argv.includes('--aplicar')

async function main() {
  console.log(APLICAR ? '🔴 MODO APLICAÇÃO — vai gravar no banco.\n' : '🟡 DRY-RUN — nada será gravado. Use --aplicar para gravar.\n')

  // 1) Trava de segurança: todo destino precisa existir na lista padronizada.
  const oficiais = new Set(NOMES_PADRONIZADOS)
  const invalidos = CORRECOES.filter((c) => !oficiais.has(c.para))
  if (invalidos.length) {
    console.error('❌ Destino fora de NOMES_PADRONIZADOS — nada será gravado:')
    for (const c of invalidos) console.error(`   "${c.de}" -> "${c.para}"`)
    process.exitCode = 1
    return
  }
  console.log(`✔ ${CORRECOES.length} pares, todos os destinos existem em NOMES_PADRONIZADOS\n`)

  // 2) Localiza os usuários. Compara a filial INTEIRA (string exata), nunca
  //    por substring: grupo de escolas irmãs ("A, B") fica fora do escopo.
  const usuarios = await prisma.usuario.findMany({
    select: { id: true, email: true, filial: true, status: true },
    orderBy: { email: 'asc' },
  })

  const alvos: Array<{ id: string; email: string; de: string; para: string; nota: string; status: string }> = []
  const naoEncontrados: string[] = []

  for (const c of CORRECOES) {
    const encontrados = usuarios.filter((u) => u.filial === c.de)
    if (!encontrados.length) naoEncontrados.push(c.de)
    for (const u of encontrados) {
      alvos.push({ id: u.id, email: u.email, de: u.filial, para: c.para, nota: c.nota, status: u.status })
    }
  }

  console.log('── O QUE VAI MUDAR ──────────────────────────────────────────\n')
  let atual = ''
  for (const a of alvos) {
    if (a.de !== atual) {
      atual = a.de
      console.log(`  "${a.de}"`)
      console.log(`     -> "${a.para}"   (${a.nota})`)
    }
    console.log(`       ${a.email}  [${a.status}]  → sync: filial="${grupoDaUnidade(a.para)}" papel=${papelDaUnidade(a.para) ?? '—'}`)
  }

  if (naoEncontrados.length) {
    console.log('\n── SEM NENHUM USUÁRIO COM ESSA GRAFIA (já corrigido ou inexistente) ──')
    for (const d of naoEncontrados) console.log(`  "${d}"`)
  }

  const inativos = alvos.filter((a) => a.status !== 'ATIVO')
  if (inativos.length) {
    console.log(`\nℹ  ${inativos.length} usuário(s) INATIVO(s) também serão corrigidos (o sync propaga o status).`)
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Total: ${alvos.length} usuário(s) em ${new Set(alvos.map((a) => a.para)).size} escola(s).`)

  if (!APLICAR) {
    console.log('\n🟡 Nada gravado. Rode com --aplicar para gravar e ressincronizar o SCE.\n')
    return
  }

  // 3) Grava no portal (fonte da verdade) e reenvia ao SCE.
  console.log('\n── GRAVANDO ─────────────────────────────────────────────────\n')
  let ok = 0
  let falhas = 0

  for (const a of alvos) {
    const u = usuarios.find((x) => x.id === a.id)!
    try {
      await prisma.usuario.update({ where: { id: a.id }, data: { filial: a.para } })
      await syncUsuarioParaSce({ ...u, filial: a.para })
      ok += 1
      console.log(`  ✔ ${a.email}`)
    } catch (e) {
      falhas += 1
      console.error(`  ❌ ${a.email}: ${e instanceof Error ? e.message : e}`)
    }
  }

  console.log(`\n${ok} atualizado(s) no portal e reenviado(s) ao SCE.`)
  if (falhas) {
    console.log(`❌ ${falhas} falha(s). Rode de novo — o script é idempotente.`)
    process.exitCode = 1
  } else {
    console.log('✅ Padronização concluída!')
  }
}

main().finally(() => prisma.$disconnect())