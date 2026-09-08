import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function check() {
  const users = await prisma.usuario.findMany()
  console.log('Users:', users.map(u => ({ email: u.email, nivel: u.nivel, primeiroLogin: u.primeiroLogin, hash: u.senhaHash.substring(0,20)+'...' })))
  
  const admin = await prisma.usuario.findUnique({ where: { email: 'admin@test.com' } })
  if (admin) {
    const valid = await bcrypt.compare('admin123', admin.senhaHash)
    console.log('Password test admin123:', valid)
  }
}

check().catch(console.error).finally(() => prisma.$disconnect())