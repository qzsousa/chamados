/**
 * fix-tipos-chamados.ts
 *
 * Converte chamados salvos com o tipo "novo" (Problema de Rede / Problema de
 * Equipamento / Problema em Sistema / Problema no E-mail) para o formato
 * convencional usado antes (Rede - ..., Equip. - ..., Sistema - ..., E-mail
 * Institucional). A subcategoria é recuperada do campo `descricao`, que o
 * formulário preenche com tokens tipo "Rede: lentidao | Equip: wifi | ...".
 *
 * Uso:
 *   npx tsx fix-tipos-chamados.ts          -> dry-run (só mostra)
 *   npx tsx fix-tipos-chamados.ts --apply  -> aplica no banco
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TIPOS_NOVOS = [
  'Problema de Rede',
  'Problema de Equipamento',
  'Problema em Sistema',
  'Problema no E-mail'
]

const REDE: Record<string, string> = {
  lentidao: 'Rede - Lentidão',
  'queda-total': 'Rede - Queda Total',
  'wifi-salas': 'Rede - Queda Wi-Fi em Salas',
  pontos: 'Rede - Pontos de Rede'
}

const EQUIP: Record<string, string> = {
  wifi: 'Equip. - Wi-Fi',
  impressora: 'Equip. - Impressora',
  fisico: 'Equip. - Manutenção Física',
  software: 'Equip. - Manutenção Software',
  formatacao: 'Equip. - Formatação',
  sistema: 'Equip. - Sistema'
}

// Chamados sem token na descrição (solicitante digitou texto livre) —
// classificados manualmente a partir da leitura da descrição.
const OVERRIDES: Record<string, string> = {
  'CH-20260915-0001': 'Sistema - PortalNet',          // habilitar acesso remoção no PortalNet
  'CH-20260915-0003': 'Equip. - Manutenção Física',   // TVs não espelham tela dos notebooks
  'CH-20260916-0001': 'Rede - Lentidão',              // internet lenta
  'CH-20260916-0002': 'Equip. - Manutenção Software', // lento, sem memória, programas desatualizados
  'CH-20260916-0004': 'Equip. - Manutenção Física',   // 35 máquinas p/ manutenção sistema + físico
  'CH-20260917-0001': 'Sistema - PortalNet',          // alteração de perfil no PortalNet
  'CH-20260917-0002': 'Sistema - PortalNet',          // acesso confirmação vagas remoção QM
  'CH-20260917-0005': 'Sistema - PortalNet',          // acesso PortalNet remoção QM 2026
  'CH-20260917-0006': 'Rede - Lentidão',              // administrativo lento
  'CH-20260917-0007': 'Equip. - Manutenção Física'    // 73 tablets e 29 notebooks quebrados
}

function campo(descricao: string, nome: string): string | null {
  const m = descricao.match(new RegExp(`${nome}: ([^|]+)`))
  return m ? m[1].trim() : null
}

function novoTipo(tipo: string, descricao: string): string | null {
  if (tipo === 'Problema no E-mail') return 'E-mail Institucional'

  if (tipo === 'Problema de Rede') {
    const v = campo(descricao, 'Rede')
    return v && REDE[v] ? REDE[v] : null
  }

  if (tipo === 'Problema de Equipamento') {
    const v = campo(descricao, 'Equip')
    if (!v || !EQUIP[v]) return null
    let t = EQUIP[v]
    if (v === 'fisico') {
      const f = campo(descricao, 'Físico')
      if (f) t += ` (${f})`
    }
    return t
  }

  if (tipo === 'Problema em Sistema') {
    const v = campo(descricao, 'Sistema')
    if (v === 'outro') return 'Sistema - Outro'
    return v ? `Sistema - ${v}` : null
  }

  return null
}

async function main() {
  const apply = process.argv.includes('--apply')

  const lista = await prisma.chamado.findMany({
    where: { tipo: { in: TIPOS_NOVOS } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, protocolo: true, tipo: true, descricao: true, createdAt: true }
  })

  let mudar = 0
  for (const c of lista) {
    const nt = OVERRIDES[c.protocolo] ?? novoTipo(c.tipo, c.descricao || '')
    if (!nt) {
      console.log(`= ${c.protocolo} | ${c.tipo} | sem classificação, mantido`)
      continue
    }
    mudar++
    console.log(`${apply ? '✔' : '?'} ${c.protocolo} | ${c.tipo}  ==>  ${nt}${OVERRIDES[c.protocolo] ? ' (manual)' : ''}`)
    if (apply) {
      await prisma.chamado.update({ where: { id: c.id }, data: { tipo: nt } })
    }
  }

  console.log(`\n${lista.length} chamado(s) com tipo novo; ${mudar} a ajustar ${apply ? '(APLICADO)' : '(dry-run — rode com --apply para gravar)'}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
