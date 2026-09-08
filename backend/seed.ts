import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function seed() {
  const senhaHash = await bcrypt.hash('admin123', 12)

  await prisma.usuario.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      nome: 'Admin Teste',
      nivel: 'ADMIN',
      filial: 'URE Leste 3',
      status: 'ATIVO',
      senhaHash,
      primeiroLogin: false
    }
  })

  await prisma.usuario.upsert({
    where: { email: 'tecnico@test.com' },
    update: {},
    create: {
      email: 'tecnico@test.com',
      nome: 'Técnico Teste',
      nivel: 'TECNICO',
      filial: 'URE Leste 3',
      status: 'ATIVO',
      senhaHash,
      primeiroLogin: false
    }
  })

  await prisma.escola.upsert({
    where: { nome: 'E.E. TESTE' },
    update: {},
    create: {
      nome: 'E.E. TESTE',
      nomeNormalizado: 'EE TESTE',
      tecnico: 'TÉCNICO TESTE'
    }
  })

  console.log('✅ Seed concluído!')
  console.log('👤 admin@test.com / admin123 (ADMIN)')
  console.log('👤 tecnico@test.com / admin123 (TECNICO)')
}

seed().catch(console.error).finally(() => prisma.$disconnect())