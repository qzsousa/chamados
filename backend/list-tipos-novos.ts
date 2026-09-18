import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const lista = await prisma.chamado.findMany({
    where: { tipo: { in: ['Problema de Rede', 'Problema de Equipamento', 'Problema em Sistema', 'Problema no E-mail'] } },
    orderBy: { createdAt: 'asc' },
    select: { protocolo: true, tipo: true, descricao: true }
  })
  for (const c of lista) {
    const d = (c.descricao || '').replace(/\s+/g, ' ').slice(0, 160)
    console.log(`${c.protocolo} | ${c.tipo} | ${d}`)
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
