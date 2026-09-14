import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })
  const total = await prisma.chamado.count()
  const porStatus = await prisma.chamado.groupBy({ by: ['status'], _count: true })
  const ultimos = await prisma.chamado.findMany({
    orderBy: { timestamp: 'desc' },
    take: 5,
    select: { protocolo: true, timestamp: true, unidade: true, status: true }
  })
  console.log('=== BANCO ===')
  console.log('Total de chamados:', total)
  console.log('Por status:', JSON.stringify(porStatus))
  console.log('5 mais recentes:', JSON.stringify(ultimos, null, 2))
  await prisma.$disconnect()
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1) })
