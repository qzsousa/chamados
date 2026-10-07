import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--aplicar')

const achar = async () => ({
  escolas: await prisma.escola.findMany({ where: { nome: { contains: 'BERNADIM', mode: 'insensitive' } } }),
  chamados: await prisma.chamado.count({ where: { unidade: { contains: 'BERNADIM', mode: 'insensitive' } } }),
  usuarios: await prisma.usuario.count({ where: { filial: { contains: 'BERNADIM', mode: 'insensitive' } } }),
})

console.log('Antes:', await achar())

if (APLICAR) {
  const e = await prisma.escola.updateMany({
    where: { nome: { contains: 'BERNADIM', mode: 'insensitive' } },
    data: { nome: 'E.E. BERNARDIM RIBEIRO', nomeNormalizado: 'BERNARDIM RIBEIRO' },
  })
  const c = await prisma.chamado.updateMany({
    where: { unidade: { contains: 'BERNADIM', mode: 'insensitive' } },
    data: { unidade: 'E.E. BERNARDIM RIBEIRO' },
  })
  const u = await prisma.usuario.updateMany({
    where: { filial: { contains: 'BERNADIM', mode: 'insensitive' } },
    data: { filial: 'E.E. BERNARDIM RIBEIRO' },
  })
  // filial legada fora do padrão "E.E. ..."
  const u2 = await prisma.usuario.updateMany({
    where: { filial: 'Bernardim Ribeiro' },
    data: { filial: 'E.E. BERNARDIM RIBEIRO' },
  })
  console.log({ escolas: e.count, chamados: c.count, usuarios: u.count + u2.count })
  console.log('Depois:', await achar())
} else {
  console.log('Dry-run. Rode com --aplicar para gravar.')
}
await prisma.$disconnect()
