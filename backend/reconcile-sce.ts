/**
 * Reconciliação em lote dos usuários no SCE.
 *
 * O sync de usuário para o SCE acontece a cada criação/edição de usuário. O
 * papel MÃE/FILHA (que habilita o acesso somente-leitura da escola FILHA aos
 * equipamentos) foi adicionado depois — por isso, usuários já cadastrados
 * precisam de um reenvio em lote para que o SCE passe a conhecer o papel.
 *
 * Uso: npm run sce:reconcile
 */
import 'dotenv/config'
import { prisma } from './src/config/prisma'
import { syncUsuarioParaSce } from './src/services/sceSync'
import { grupoDaUnidade, papelDaUnidade } from './src/services/normalization'

async function main() {
  const usuarios = await prisma.usuario.findMany({
    select: { email: true, nome: true, nivel: true, filial: true, status: true },
    orderBy: { email: 'asc' }
  })

  console.log(`↻ Reenviando ${usuarios.length} usuário(s) ao SCE...\n`)

  const resumos: Record<string, number> = { MAE: 0, FILHA: 0, sem_papel: 0 }
  let falhas = 0

  for (const u of usuarios) {
    const papel = papelDaUnidade(u.filial)
    resumos[papel ?? 'sem_papel'] += 1
    const marcador = papel === 'FILHA' ? '🔒 somente leitura' : papel === 'MAE' ? '🔓 administra' : '   —'
    try {
      await syncUsuarioParaSce(u)
      console.log(`${marcador} ${u.email} · ${grupoDaUnidade(u.filial)}`)
    } catch (e) {
      falhas += 1
      console.error(`❌ ${u.email}: ${e instanceof Error ? e.message : e}`)
    }
  }

  console.log(`\nMÃE: ${resumos.MAE} · FILHA: ${resumos.FILHA} · sem par: ${resumos.sem_papel}`)
  if (falhas) {
    console.log(`❌ ${falhas} falha(s) — rode novamente para tentá-las de novo.`)
    process.exitCode = 1
  } else {
    console.log('✅ Reconciliação concluída!')
  }
}

main().finally(() => prisma.$disconnect())
