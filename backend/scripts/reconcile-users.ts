/**
 * Reconciliação inicial de usuários SCE → chamados (one-time).
 *
 * O que faz:
 *  - Lê a tabela `usuarios` do SCE (Supabase do SCE, via credenciais do .env do SCE)
 *  - Para cada usuário Ativo no SCE que NÃO existe no chamados (por e-mail): cria
 *    com senha temporária (primeiroLogin=true) e nível mapeado.
 *  - Para usuários que existem nos dois: apenas REPORTA diferenças de nível/filial.
 *  - Filial é normalizada com `padronizarNomeEscola` (ex.: "Adhemar Antonio Prado Prof"
 *    → "E.E. ADHEMAR ANTONIO PRADO") para casar com as unidades dos chamados.
 *
 * Uso:
 *   npx tsx scripts/reconcile-users.ts           # dry-run (só mostra)
 *   npx tsx scripts/reconcile-users.ts --apply   # executa as criações
 *
 * Depende de: SCE .env em ../../sce/.env (para ler a base de usuários do SCE).
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '../src/config/prisma'
import { padronizarNomeEscola, normalizarNomeEscola, NOMES_PADRONIZADOS } from '../src/services/normalization'
import { passwordPolicy } from '../src/utils/tokens'

const APPLY = process.argv.includes('--apply')

/**
 * Casa a filial do SCE (ex.: "Alcides Boscolo Prof") com o nome padronizado dos
 * chamados (ex.: "E.E. ALCIDES BOSCOLO"). Estratégia: match exato normalizado,
 * depois prefixo em qualquer direção ("PROF"/"DR" são sufixos comuns no SCE).
 */
function casarFilialComChamados(filialSce: string): { nome: string; metodo: string } {
  if (!filialSce) return { nome: '', metodo: 'vazio' }
  const direto = padronizarNomeEscola(filialSce)
  if (direto !== filialSce || filialSce.toUpperCase().startsWith('E.')) return { nome: direto, metodo: 'exato' }

  const sceNorm = normalizarNomeEscola(filialSce)
  for (const padrao of NOMES_PADRONIZADOS) {
    const pNorm = normalizarNomeEscola(padrao)
    if (pNorm === sceNorm) return { nome: padrao, metodo: 'normalizado' }
    if (sceNorm.startsWith(pNorm) || pNorm.startsWith(sceNorm)) {
      return { nome: padrao, metodo: 'prefixo' }
    }
  }
  return { nome: filialSce, metodo: 'SEM_MATCH' }
}

// Lê credenciais do SCE diretamente do .env dele (sem poluir o env do chamados)
const sceEnvPath = path.resolve(__dirname, '../../../sce/.env')
if (!fs.existsSync(sceEnvPath)) {
  console.error(`Não achei o .env do SCE em ${sceEnvPath}`)
  process.exit(1)
}
const sceEnv = dotenv.parse(fs.readFileSync(sceEnvPath))
const sce = createClient(sceEnv.SUPABASE_URL!, sceEnv.SUPABASE_SERVICE_ROLE_KEY!)

// Matriz → ADMIN, AdminFilial → GESTOR, Tecnico → TECNICO, Filial → VISUALIZADOR
const MAPA_NIVEL: Record<string, 'ADMIN' | 'TECNICO' | 'GESTOR' | 'VISUALIZADOR'> = {
  Matriz: 'ADMIN',
  AdminFilial: 'GESTOR',
  Tecnico: 'TECNICO',
  Filial: 'VISUALIZADOR',
}

interface SceUsuario {
  email: string
  nome: string
  nivel: string
  filial: string | null
  status: string
}

async function main() {
  const { data: sceUsuarios, error } = await sce
    .from('usuarios')
    .select('email, nome, nivel, filial, status')
  if (error) throw new Error(`Falha ao ler usuarios do SCE: ${error.message}`)

  const ativos = (sceUsuarios as SceUsuario[]).filter((u) => u.status === 'Ativo')
  console.log(`SCE: ${sceUsuarios.length} usuários (${ativos.length} ativos)`)

  let criados = 0
  let jaExistiam = 0
  let divergencias = 0

  for (const u of ativos) {
    const email = u.email.trim().toLowerCase()
    const existente = await prisma.usuario.findUnique({ where: { email } })

    const nivelPortal = MAPA_NIVEL[u.nivel] || 'VISUALIZADOR'
    // Tecnico (multi-unidade): filial no chamados é o setor — usamos o primeiro nome como setor; revisar depois
    const filialBruta = (u.filial || '').split(',')[0]?.trim() || ''
    const casamento = casarFilialComChamados(filialBruta)
    const filialPortal = casamento.nome || 'UNIDADE LESTE 3'

    if (existente) {
      jaExistiam++
      const divergeNivel = existente.nivel !== nivelPortal && !(existente.nivel === 'ADMIN' && nivelPortal === 'ADMIN')
      const divergeFilial = existente.filial !== filialPortal && existente.nivel !== 'ADMIN' && nivelPortal !== 'ADMIN'
      if (divergeNivel || divergeFilial) {
        divergencias++
        console.log(
          `  ~ ${email}: chamados(${existente.nivel}/${existente.filial}) vs SCE(${u.nivel}/${u.filial})`,
        )
      }
      continue
    }

    console.log(`  + criar: ${email} | ${u.nome} | ${nivelPortal} | ${filialPortal}${casamento.metodo === 'SEM_MATCH' ? '  ⚠ filial sem match' : ''}`)
    if (casamento.metodo === 'prefixo') console.log(`      (casou por prefixo: "${filialBruta}" → "${filialPortal}")`)
    if (APPLY) {
      const senhaTemporaria = passwordPolicy.generateTemp()
      await prisma.usuario.create({
        data: {
          email,
          nome: u.nome,
          nivel: nivelPortal,
          filial: filialPortal,
          senhaHash: await bcrypt.hash(senhaTemporaria, 12),
          primeiroLogin: true,
        },
      })
      criados++
    }
  }

  console.log('')
  console.log(`Resumo: ${jaExistiam} já existiam · ${criados} criados · ${divergencias} divergências reportadas`)
  if (!APPLY) console.log('(dry-run) Rode com --apply para criar os usuários faltantes.')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
