import { prisma } from './src/config/prisma'
import { syncInventario } from './src/services/migration'

async function main() {
  const result = await syncInventario()
  if (!result.ok && result.motivo) {
    console.log('❌', result.motivo)
    process.exitCode = 1
  } else {
    console.log('✅ Sincronização de escolas e inventário concluída!')
  }
}

main().finally(() => prisma.$disconnect())