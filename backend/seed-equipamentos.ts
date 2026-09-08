import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const equipamentos = [
  // Notebooks
  { categoria: 'Notebook', marca: 'Dell', modelo: 'Latitude 5420' },
  { categoria: 'Notebook', marca: 'Dell', modelo: 'Latitude 5520' },
  { categoria: 'Notebook', marca: 'Dell', modelo: 'Latitude 3420' },
  { categoria: 'Notebook', marca: 'Lenovo', modelo: 'ThinkPad E14' },
  { categoria: 'Notebook', marca: 'Lenovo', modelo: 'ThinkPad E15' },
  { categoria: 'Notebook', marca: 'Lenovo', modelo: 'ThinkPad L14' },
  { categoria: 'Notebook', marca: 'HP', modelo: 'ProBook 440 G8' },
  { categoria: 'Notebook', marca: 'HP', modelo: 'ProBook 450 G8' },
  { categoria: 'Notebook', marca: 'Acer', modelo: 'TravelMate P2' },
  { categoria: 'Notebook', marca: 'Asus', modelo: 'ExpertBook B9' },

  // Tablets
  { categoria: 'Tablet', marca: 'Samsung', modelo: 'Galaxy Tab A7' },
  { categoria: 'Tablet', marca: 'Samsung', modelo: 'Galaxy Tab A8' },
  { categoria: 'Tablet', marca: 'Samsung', modelo: 'Galaxy Tab S6 Lite' },
  { categoria: 'Tablet', marca: 'Apple', modelo: 'iPad 9ª Geração' },
  { categoria: 'Tablet', marca: 'Apple', modelo: 'iPad 10ª Geração' },
  { categoria: 'Tablet', marca: 'Lenovo', modelo: 'Tab M10' },
  { categoria: 'Tablet', marca: 'Multilaser', modelo: 'M10A' },

  // Impressoras
  { categoria: 'Impressora', marca: 'HP', modelo: 'LaserJet Pro M404' },
  { categoria: 'Impressora', marca: 'HP', modelo: 'LaserJet Pro M428' },
  { categoria: 'Impressora', marca: 'Brother', modelo: 'HL-L2350DW' },
  { categoria: 'Impressora', marca: 'Brother', modelo: 'HL-L3210CW' },
  { categoria: 'Impressora', marca: 'Epson', modelo: 'EcoTank L3250' },
  { categoria: 'Impressora', marca: 'Epson', modelo: 'EcoTank L4260' },
  { categoria: 'Impressora', marca: 'Canon', modelo: 'MF244dw' },
  { categoria: 'Impressora', marca: 'Xerox', modelo: 'WorkCentre 3345' },
]

async function seed() {
  let criados = 0
  for (const eq of equipamentos) {
    await prisma.equipamento.upsert({
      where: { categoria_marca_modelo: { categoria: eq.categoria, marca: eq.marca, modelo: eq.modelo } },
      update: {},
      create: eq
    })
    criados++
  }
  console.log(`✅ ${criados} equipamentos seedados`)
}

seed().catch(console.error).finally(() => prisma.$disconnect())