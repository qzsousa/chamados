import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanAndSeed() {
  // Limpa tudo
  await prisma.equipamento.deleteMany()
  console.log('🗑️ Equipamentos anteriores removidos')
  
  // Seed apenas com os dados do usuário
  const equipamentos = [
    { categoria: 'Notebook', marca: 'Lenovo', modelo: 'ThinkPad L14 Gen 2' },
    { categoria: 'Notebook', marca: 'Positivo', modelo: 'Master N1110' },
    { categoria: 'Notebook', marca: 'Positivo', modelo: 'Master N1210' },
    { categoria: 'Notebook', marca: 'Multilaser', modelo: 'PC114' },
    { categoria: 'Notebook', marca: 'Multilaser', modelo: 'Ultra UL150' },
    { categoria: 'Notebook', marca: 'Samsung', modelo: 'Chromebook' },
    { categoria: 'Desktop', marca: 'Diebold', modelo: 'TW9850' },
    { categoria: 'Desktop', marca: 'Lenovo', modelo: 'ThinkCentre M75S-2' },
    { categoria: 'Desktop', marca: 'Lenovo', modelo: 'ThinkCentre' },
    { categoria: 'Plataforma de Carregamento', marca: 'TES', modelo: 'K2X - 40V' },
    { categoria: 'Plataforma de Carregamento', marca: 'TES', modelo: 'K4CG - 40V' },
    { categoria: 'Impressora', marca: 'HP', modelo: 'LaserJet Pro M404dn' },
    { categoria: 'Impressora', marca: 'Brother', modelo: 'HL-L2350DW' },
    { categoria: 'Impressora', marca: 'Epson', modelo: 'EcoTank L3250' },
    { categoria: 'Celular', marca: 'Redmi', modelo: '12' },
    { categoria: 'Celular', marca: 'Redmi', modelo: '12C' },
    { categoria: 'Celular', marca: 'Redmi', modelo: '13C' },
    { categoria: 'Celular', marca: 'Redmi', modelo: '9C' },
    { categoria: 'Celular', marca: 'Redmi', modelo: 'A1' },
    { categoria: 'Celular', marca: 'Redmi', modelo: 'A1 +' },
    { categoria: 'Celular', marca: 'Redmi', modelo: 'A3' },
    { categoria: 'Celular', marca: 'Redmi', modelo: 'Note 11S' },
    { categoria: 'Celular', marca: 'Redmi', modelo: 'Note 11' },
    { categoria: 'Celular', marca: 'Redmi', modelo: 'Note 11 Pro' },
    { categoria: 'Celular', marca: 'Redmi', modelo: 'Note 12' },
    { categoria: 'Celular', marca: 'Redmi', modelo: 'Note 12 Pro' },
    { categoria: 'Celular', marca: 'Redmi', modelo: 'Note 12S' },
    { categoria: 'Celular', marca: 'Redmi', modelo: 'Note 13' },
    { categoria: 'Celular', marca: 'Redmi', modelo: 'Note 13 PRO' },
    { categoria: 'Celular', marca: 'Redmi', modelo: 'Note 14' },
    { categoria: 'Celular', marca: 'Redmi', modelo: 'Note 9' },
    { categoria: 'Celular', marca: 'Redmi', modelo: 'Note 8' },
    { categoria: 'Celular', marca: 'Motorola', modelo: 'G13' },
    { categoria: 'Celular', marca: 'Xiaomi', modelo: 'Poco C65' },
    { categoria: 'Celular', marca: 'Xiaomi', modelo: 'Poco M3 PRO' },
    { categoria: 'Celular', marca: 'Xiaomi', modelo: 'Poco M5' },
    { categoria: 'Celular', marca: 'Xiaomi', modelo: 'Poco M6 PRO' },
    { categoria: 'Celular', marca: 'Xiaomi', modelo: 'Poco X5' },
    { categoria: 'Celular', marca: 'Realme', modelo: 'C51' },
    { categoria: 'Celular', marca: 'Realme', modelo: 'C61' },
    { categoria: 'Celular', marca: 'Realme', modelo: 'Note 50' },
    { categoria: 'Celular', marca: 'Multilaser', modelo: 'G2' },
    { categoria: 'Tablet', marca: 'Positivo', modelo: 'T2040' },
    { categoria: 'Tablet', marca: 'Positivo', modelo: 'T2070' },
  ]

  for (const eq of equipamentos) {
    await prisma.equipamento.create({ data: eq })
  }
  
  console.log(`✅ ${equipamentos.length} equipamentos inseridos`)
  
  // Resumo
  const cats = await prisma.equipamento.findMany({
    select: { categoria: true },
    distinct: ['categoria'],
    orderBy: { categoria: 'asc' }
  })
  console.log('\n📋 Categorias no banco:')
  for (const c of cats) {
    const count = await prisma.equipamento.count({ where: { categoria: c.categoria } })
    console.log(`  ${c.categoria}: ${count} modelos`)
  }
}

cleanAndSeed().catch(console.error).finally(() => prisma.$disconnect())