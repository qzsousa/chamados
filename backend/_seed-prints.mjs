/**
 * Semeia chamados sintéticos em CADA estado do fluxo, para recriar as telas
 * usadas nas capturas de docs/14-fluxo-atendimento-chamado.md.
 *
 * São dados fictícios (prefixo CH-TESTE-) e podem ser apagados sem risco:
 * `npx tsx _seed-prints.mjs --limpar` faz isso.
 *
 * Os usuários das capturas são de `_criar-usuarios-teste.mjs`, no backend/:
 * teste.tecnico@local.com (técnico), teste.mae@local.com (gestor da unidade),
 * teste.filha@local.com — todos com a senha Tec2026..
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

const PREMIO = 'CH-TESTE'
const TECNICO = 'TESTE TECNICO ACEITE'
const UNIDADE = 'E.E. CESAR DONATO CALABREZ'

if (process.argv.includes('--limpar')) {
  const r = await p.chamado.deleteMany({ where: { protocolo: { startsWith: PREMIO } } })
  console.log(`removidos ${r.count} chamados de teste`)
  await p.$disconnect()
  process.exit(0)
}

/** Chamados em cada etapa, com as atividades que o estado implica. */
const CENARIOS = [
  {
    protocolo: `${PREMIO}-ACEITE`,
    status: 'ENCAMINHADO',
    solicitante: 'Angela Fabiola Takamori Panichi',
    funcao: 'Diretor',
    email: 'angela.takamori@educacao.sp.gov.br',
    tipo: 'Rede - Lentidão',
    descricao:
      'Desde segunda-feira a internet da sala dos professores está muito lenta. ' +
      'Os alunos já reclamaram porque não conseguem acessar as atividades.',
    urgencia: 'Alta',
    responsavel: TECNICO,
    atividades: [],
    historico: 'Chamado criado em 06/10/2026, 08:12:04',
  },
  {
    protocolo: `${PREMIO}-ANDAMENTO`,
    status: 'ANDAMENTO',
    solicitante: 'Roberto Menezes Alves',
    funcao: 'Coordenador Pedagógico',
    email: 'roberto.alves@educacao.sp.gov.br',
    tipo: 'Equipamento',
    descricao:
      'Equip: impressora | Modelo: HP Deskjet 2724\n' +
      'A impressora da secretaria fica apagando sozinha e não sai nenhuma folha.',
    urgencia: 'Média',
    responsavel: TECNICO,
    aceitoEm: new Date('2026-10-06T09:00:00'),
    aceitoPor: TECNICO,
    historico:
      'Chamado criado em 05/10/2026, 14:30:11\n' +
      '[06/10/2026, 09:00:00] Chamado aceito por ' + TECNICO,
    atividades: [
      {
        tipo: 'REGISTRO',
        texto:
          'Fui até a secretaria e a impressora estava sem papel. Repor o toner e ' +
          'reiniciar o equipamento resolveu o apagão.',
        horas: '2026-10-06T10:20:00',
      },
    ],
  },
  {
    protocolo: `${PREMIO}-CONFERIR`,
    status: 'AGUARDANDO_CONFERENCIA',
    solicitante: 'Marcia Regina Souza',
    funcao: 'Diretora',
    email: 'marcia.souza@educacao.sp.gov.br',
    tipo: 'Rede - Lentidão',
    descricao:
      'A rede cai todos os dias no período da manhã, justamente quando as aulas ' +
      'de VMs começam. O professor acabou usando o celular como roteador.',
    urgencia: 'Alta',
    responsavel: TECNICO,
    aceitoEm: new Date('2026-10-06T08:00:00'),
    aceitoPor: TECNICO,
    concluidoEm: new Date('2026-10-06T15:40:00'),
    descricaoResolucao: 'Testei a rede da sala 4 com o técnico da operadora.',
    historico:
      'Chamado criado em 05/10/2026, 07:45:00\n' +
      '[06/10/2026, 08:00:00] Chamado aceito por ' + TECNICO,
    atividades: [
      {
        tipo: 'REGISTRO',
        texto:
          'Verifiquei o cabo de rede do rack: estava mal conectado. Refiz a ' +
          'conexão e a porta passou a negociar a 1 Gbps.',
        horas: '2026-10-06T09:30:00',
      },
      {
        tipo: 'REGISTRO',
        texto: 'Testei a navegação em três computadores da sala 4: 42 Mbps estáveis.',
        horas: '2026-10-06T14:10:00',
      },
      {
        tipo: 'CONCLUSAO',
        texto:
          'Recoloquei o cabo do rack e testei a rede com três equipamentos da ' +
          'sala 4. A conexão está estável em 42 Mbps. Pode conferir aí na escola.',
        horas: '2026-10-06T15:40:00',
      },
    ],
  },
  {
    protocolo: `${PREMIO}-REABERTO`,
    status: 'ABERTO',
    solicitante: 'Sandra Lopes Ferreira',
    funcao: 'Diretora',
    email: 'sandra.ferreira@educacao.sp.gov.br',
    tipo: 'Equipamento',
    descricao: 'Equip: projetor | Marca: Epson\nO projetor da biblioteca não acende.',
    urgencia: 'Média',
    responsavel: TECNICO,
    aceitoEm: new Date('2026-10-05T09:00:00'),
    aceitoPor: TECNICO,
    reaberturas: 1,
    historico:
      'Chamado criado em 04/10/2026, 16:00:00\n' +
      '[05/10/2026, 09:00:00] Chamado aceito por ' + TECNICO +
      '\n[05/10/2026, 16:30:00] Chamado contestado pela escola (Marcia Regina Souza) e reaberto',
    atividades: [
      {
        tipo: 'REGISTRO',
        texto: 'Troquei a fonte do projetor, que estava com a proteção ativa.',
        horas: '2026-10-05T11:00:00',
      },
      {
        tipo: 'CONCLUSAO',
        texto: 'Fonte trocada. O projetor acendeu normalmente no teste.',
        horas: '2026-10-05T16:20:00',
      },
      {
        tipo: 'CONTESTACAO',
        texto:
          'O projetor acendeu na hora da visita, mas ontem a escola tentou ' +
          'usar de novo e ele apagou outra vez. Parece que o defeito voltou.',
        horas: '2026-10-06T08:15:00',
      },
    ],
  },
  {
    protocolo: `${PREMIO}-RESOLVIDO`,
    status: 'RESOLVIDO',
    solicitante: 'Jose Carlos Pereira',
    funcao: 'Coordenador de Informatica',
    email: 'josecarlos.pereira@educacao.sp.gov.br',
    tipo: 'Equipamento',
    descricao:
      'Equip: computador | Modelo: Positivo\nO computador da coordenacao ' +
      'reinicia sozinho quando abre o sistema.',
    urgencia: 'Média',
    responsavel: TECNICO,
    aceitoEm: new Date('2026-10-02T09:00:00'),
    aceitoPor: TECNICO,
    concluidoEm: new Date('2026-10-02T16:00:00'),
    conferidoEm: new Date('2026-10-03T08:30:00'),
    conferidoPor: 'DIRETOR',
    descricaoResolucao: 'Troquei a fonte e fiz teste de estressamento por 2 horas.',
    historico:
      'Chamado criado em 01/10/2026, 11:00:00\n' +
      '[02/10/2026, 09:00:00] Chamado aceito por ' + TECNICO +
      '\n[03/10/2026, 08:30:00] Conferência aprovada pela escola',
    atividades: [
      {
        tipo: 'REGISTRO',
        texto: 'Fonte com falha: medindo a tensão, ela estava abaixo do esperado.',
        horas: '2026-10-02T11:00:00',
      },
      {
        tipo: 'CONCLUSAO',
        texto:
          'Fonte substituída por uma nova e rodei teste de estressamento por duas ' +
          'horas. Nenhum reinício no período.',
        horas: '2026-10-02T16:00:00',
      },
      {
        tipo: 'APROVACAO',
        texto: 'Tudo certo por aqui, obrigado pelo atendimento rápido.',
        horas: '2026-10-03T08:30:00',
      },
    ],
  },
]

for (const c of CENARIOS) {
  const { atividades, ...dados } = c

  const chamado = await p.chamado.upsert({
    where: { protocolo: dados.protocolo },
    create: { ...dados, unidade: UNIDADE },
    update: { ...dados, unidade: UNIDADE },
  })

  await p.chamadoAtividade.deleteMany({ where: { chamadoId: chamado.id } })
  for (const a of atividades) {
    const daEscola = a.tipo === 'CONTESTACAO' || a.tipo === 'APROVACAO'
    await p.chamadoAtividade.create({
      data: {
        chamadoId: chamado.id,
        tipo: a.tipo,
        autorNome: daEscola ? 'DIRETOR' : TECNICO,
        autorNivel: daEscola ? 'GESTOR' : 'TECNICO',
        texto: a.texto,
        criadoEm: new Date(a.horas),
      },
    })
  }

  console.log(
    `${chamado.protocolo.padEnd(18)} ${chamado.status.padEnd(24)} ${atividades.length} registro(s)`,
  )
}

await p.$disconnect()