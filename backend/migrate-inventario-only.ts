import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from './src/config/prisma'
import { google } from 'googleapis'
import { migrateEscolas, migrateInventario } from './src/services/migration'

async function main() {
  let serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON

  if (!serviceAccountJson) {
    try {
      serviceAccountJson = readFileSync(join(process.cwd(), 'gcp-service-account.json'), 'utf-8')
    } catch {
      serviceAccountJson = ''
    }
  }

  const inventarioSheetsId = process.env.GOOGLE_INVENTARIO_SHEETS_ID || process.env.GOOGLE_SHEETS_ID

  if (!serviceAccountJson || !inventarioSheetsId) {
    console.log('⚠️ GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_INVENTARIO_SHEETS_ID não configurados.')
    return
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(serviceAccountJson),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  })
  const sheets = google.sheets({ version: 'v4', auth })

  console.log('🏫 Migrando escolas...')
  await migrateEscolas()

  console.log('📦 Migrando inventário...')
  await migrateInventario(sheets)

  console.log('✅ Escolas e inventário migrados!')
}

main().catch(e => {
  console.error('❌ Erro:', e)
  process.exit(1)
}).finally(() => prisma.$disconnect())