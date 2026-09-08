import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function test() {
  const cats = await prisma.equipamento.findMany({ select: { categoria: true }, distinct: ['categoria'], orderBy: { categoria: 'asc' } })
  console.log('Categorias:', cats.map(c => c.categoria))
  
  const marcas = await prisma.equipamento.findMany({ where: { categoria: 'Notebook' }, select: { marca: true }, distinct: ['marca'], orderBy: { marca: 'asc' } })
  console.log('Marcas Notebook:', marcas.map(m => m.marca))
  
  const modelos = await prisma.equipamento.findMany({ where: { categoria: 'Notebook', marca: 'Dell' }, select: { modelo: true }, distinct: ['modelo'], orderBy: { modelo: 'asc' } })
  console.log('Modelos Dell:', modelos.map(m => m.modelo))
}

test().catch(console.error).finally(() => prisma.$disconnect())