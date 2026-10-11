import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { pino } from 'pino'
import { Prisma } from '@prisma/client'
import { errorHandler } from '../middleware/errorHandler'
import { prisma } from '../config/prisma'
import { avaliarRespostasFormulario, CategoriaAvaliavel } from './formulario'
import { criarChamadoPublic } from './chamados'

vi.mock('../config/prisma', () => ({
  prisma: {
    chamado: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn()
    },
    formularioCategoria: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}))

vi.mock('../services/normalization', () => ({
  normalizarNomeEscola: vi.fn((nome: string) => nome),
  getMapaTecnicos: vi.fn(() => ({ 'E.E. TESTE': 'TECNICO1' }))
}))

vi.mock('../services/migration', () => ({
  getMapaInventario: vi.fn(() => Promise.resolve({ 'E.E. TESTE': 'CONCLUIDO' }))
}))

vi.mock('../services/notificacoes', () => ({
  notificarAdmins: vi.fn(() => Promise.resolve()),
  notificarUnidade: vi.fn(() => Promise.resolve()),
  notificarUsuario: vi.fn(() => Promise.resolve()),
  notificarTecnicoResponsavel: vi.fn(() => Promise.resolve())
}))

vi.mock('../services/email', () => ({
  notificarChamadoStatusAlterado: vi.fn(() => Promise.resolve()),
  notificarChamadoCriado: vi.fn(() => Promise.resolve()),
  notificarChamadoConcluido: vi.fn(() => Promise.resolve())
}))

vi.mock('../services/encaminhamento', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/encaminhamento')>()),
  encaminharPorRegras: vi.fn(() => Promise.resolve(false)),
  encaminharChamado: vi.fn(),
  tecnicosDaUnidade: vi.fn(() => Promise.resolve([])),
  encaminharPendentes: vi.fn()
}))

// O Supabase não existe no teste: o anexo "sobe" sem sair para a rede.
vi.mock('../services/anexos', () => ({
  salvarAnexo: vi.fn(async (_b64: string, nome: string) => `https://storage.test/${nome}`),
  salvarAnexoComPath: vi.fn(async (_b64: string, nome: string, tipo: string, pasta: string) => ({
    url: `https://storage.test/${pasta}/${nome}`,
    path: `${pasta}/${nome}`
  })),
  limparAnexosTemporariosExpirados: vi.fn(() => Promise.resolve(0))
}))

vi.mock('../middleware/auth', () => {
  const authMiddleware = (req: any, _res: any, next: any) => { req.userRecord = { id: 'u1', nivel: 'ADMIN' }; next() }
  const requireRole = () => (_req: any, _res: any, next: any) => next()
  return { authMiddleware, requireRole, attachUserRecord: authMiddleware, requireFilialAccess: requireRole }
})

// ============================================
// AVALIAÇÃO DAS CONDIÇÕES (função pura)
// ============================================

/**
 * Espelha a categoria "Rede" do seed: uma pergunta de opções com três alertas
 * (link, anexo obrigatório e encerramento) e duas perguntas condicionais.
 */
const REDE: CategoriaAvaliavel = {
  chave: 'rede',
  perguntas: [
    {
      id: 'p1',
      rotulo: 'Qual é o problema de rede?',
      tipo: 'OPCOES',
      obrigatoria: true,
      opcoes: [
        { rotulo: 'Lentidão' },
        { rotulo: 'Queda total de internet' },
        { rotulo: 'Solicitação de pontos de rede', alerta: { texto: 'Anexe as fotos', tipo: 'aviso', exigeAnexo: true } }
      ]
    },
    {
      id: 'p2',
      rotulo: 'A escola possui energia elétrica agora?',
      tipo: 'OPCOES',
      obrigatoria: true,
      dependeDePerguntaId: 'p1',
      dependeDeOpcao: 'Queda total de internet',
      opcoes: [
        { rotulo: 'Sim, há energia na escola' },
        {
          rotulo: 'Não, está sem energia no momento',
          alerta: { texto: 'Aguarde o retorno da energia.', tipo: 'aviso', encerra: true }
        }
      ]
    },
    {
      id: 'p3',
      rotulo: 'Quais salas ou locais estão sem conexão?',
      tipo: 'TEXTO_LONGO',
      obrigatoria: true,
      dependeDePerguntaId: 'p1',
      dependeDeOpcao: 'Queda de Wi-Fi em salas ou locais específicos'
    }
  ]
}

describe('Condições do formulário (avaliarRespostasFormulario)', () => {
  it('exige a pergunta obrigatória sem condição quando não veio resposta', () => {
    const r = avaliarRespostasFormulario(REDE, [])
    expect(r.faltando.map((f) => f.perguntaId)).toEqual(['p1'])
    // p2/p3 são condicionais: sem resposta em p1 elas não aparecem.
    expect(r.faltando).toHaveLength(1)
  })

  it('abre a pergunta condicional quando a resposta do pai é a esperada', () => {
    const r = avaliarRespostasFormulario(REDE, [{ perguntaId: 'p1', resposta: 'Queda total de internet' }])
    expect(r.faltando.map((f) => f.perguntaId)).toEqual(['p2'])
    expect(r.faltando).not.toContainEqual(expect.objectContaining({ perguntaId: 'p3' }))
  })

  it('NÃO abre a pergunta condicional quando o pai tem outra resposta', () => {
    const r = avaliarRespostasFormulario(REDE, [{ perguntaId: 'p1', resposta: 'Lentidão' }])
    expect(r.faltando).toEqual([])
    expect(r.respostas).toEqual([
      { perguntaId: 'p1', rotulo: 'Qual é o problema de rede?', resposta: 'Lentidão' }
    ])
  })

  it('compara a opção sem diferenciar acento, caixa e espaço a mais', () => {
    const r = avaliarRespostasFormulario(
      REDE,
      [{ perguntaId: 'p1', resposta: '  solicitacao   de  PONTOS de rede ' }]
    )
    expect(r.faltando).toEqual([])
    // Grava o rótulo CANÔNICO da opção, não o que o navegador mandou.
    expect(r.respostas[0].resposta).toBe('Solicitação de pontos de rede')
    expect(r.exigeAnexo).toBe(true)
  })

  it('sinaliza o anexo exigido e o desconto quando o arquivo veio', () => {
    const respostas = [{ perguntaId: 'p1', resposta: 'Solicitação de pontos de rede' }]
    expect(avaliarRespostasFormulario(REDE, respostas, 0).exigeAnexo).toBe(true)
    expect(avaliarRespostasFormulario(REDE, respostas, 1).exigeAnexo).toBe(false)
  })

  it('sinaliza encerramento quando a resposta escolhida manda esperar', () => {
    const r = avaliarRespostasFormulario(REDE, [
      { perguntaId: 'p1', resposta: 'Queda total de internet' },
      { perguntaId: 'p2', resposta: 'Não, está sem energia no momento' }
    ])
    expect(r.encerra).toEqual({
      perguntaId: 'p2',
      rotulo: 'A escola possui energia elétrica agora?',
      texto: 'Aguarde o retorno da energia.'
    })
  })

  it('descarta resposta de opção que não existe mais', () => {
    const r = avaliarRespostasFormulario(REDE, [{ perguntaId: 'p1', resposta: 'Opção apagada pelo admin' }])
    expect(r.respostas).toEqual([])
    // Não vira "faltando": resposta inválida é descarte, não esquecimento.
    expect(r.faltando).toEqual([])
  })

it('descarta resposta de pergunta que não apareceu para esta escola', () => {
    const r = avaliarRespostasFormulario(REDE, [
      { perguntaId: 'p1', resposta: 'Lentidão' },
      // p3 só existe para "Queda de Wi-Fi em salas ou locais específicos"; veio
      // de uma tela antiga (ou de um corpo montado à mão) e não é a resposta.
      { perguntaId: 'p3', resposta: 'Sala 5, Quadra' }
    ])
    expect(r.respostas.map((x) => x.perguntaId)).toEqual(['p1'])
  })

  it('abre o filho quando a condição é só dependeDePerguntaId (qualquer resposta do pai)', () => {
    const categoria: CategoriaAvaliavel = {
      chave: 'x',
      perguntas: [
        { id: 'a', rotulo: 'Pai', tipo: 'TEXTO', obrigatoria: true },
        { id: 'b', rotulo: 'Filho', tipo: 'TEXTO', obrigatoria: true, dependeDePerguntaId: 'a' }
      ]
    }
    expect(avaliarRespostasFormulario(categoria, [{ perguntaId: 'a', resposta: 'qqq' }]).faltando).toEqual([
      { perguntaId: 'b', rotulo: 'Filho' }
    ])
    // Pai sem resposta: o filho nem aparece.
    expect(avaliarRespostasFormulario(categoria, []).faltando).toEqual([{ perguntaId: 'a', rotulo: 'Pai' }])
  })

  it('trata condição apontando para pergunta inexistente como invisível', () => {
    const categoria: CategoriaAvaliavel = {
      chave: 'x',
      perguntas: [
        { id: 'b', rotulo: 'Órfã', tipo: 'TEXTO', obrigatoria: true, dependeDePerguntaId: 'sumiu' }
      ]
    }
    const r = avaliarRespostasFormulario(categoria, [{ perguntaId: 'b', resposta: 'texto' }])
    expect(r.respostas).toEqual([])
    expect(r.faltando).toEqual([])
  })

  it('não entra em laço com dependência circular', () => {
    const categoria: CategoriaAvaliavel = {
      chave: 'x',
      perguntas: [
        { id: 'a', rotulo: 'A', tipo: 'TEXTO', obrigatoria: true, dependeDePerguntaId: 'b' },
        { id: 'b', rotulo: 'B', tipo: 'TEXTO', obrigatoria: true, dependeDePerguntaId: 'a' }
      ]
    }
    expect(avaliarRespostasFormulario(categoria, [{ perguntaId: 'a', resposta: 'x' }]).respostas).toEqual([])
  })

  it('ignora pergunta desativada pelo admin', () => {
    const categoria: CategoriaAvaliavel = {
      chave: 'x',
      perguntas: [{ id: 'a', rotulo: 'Antiga', tipo: 'TEXTO', obrigatoria: true, ativa: false }]
    }
    const r = avaliarRespostasFormulario(categoria, [{ perguntaId: 'a', resposta: 'x' }])
    expect(r.respostas).toEqual([])
    expect(r.faltando).toEqual([])
  })

  it('aceita a última resposta quando a pergunta vem repetida', () => {
    const r = avaliarRespostasFormulario(REDE, [
      { perguntaId: 'p1', resposta: 'Lentidão' },
      { perguntaId: 'p1', resposta: 'Queda total de internet' }
    ])
    expect(r.respostas).toHaveLength(1)
    expect(r.respostas[0].resposta).toBe('Queda total de internet')
    // E a condição da segunda passou a valer.
    expect(r.faltando.map((f) => f.perguntaId)).toEqual(['p2'])
  })
})

// ============================================
// ABERTURA DO CHAMADO COM O FORMULÁRIO
// ============================================

const PAYLOAD_BASE = {
  unidade: 'E.E. TESTE',
  solicitante: 'Maria Silva',
  tipo: 'Rede',
  descricao: 'Sem conexão na sala 5',
  urgencia: 'Média',
  email: 'maria.silva@educacao.sp.gov.br'
}

const createApp = () => {
  const app = express()
  // Mesmo limite do index.ts: sem ele o body-parser cortaria o anexo grande
  // antes do código do formulário chegar a olhá-lo.
  app.use(express.json({ limit: '25mb' }))
  app.post('/api/chamados', criarChamadoPublic)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('POST /chamados com o formulário dinâmico', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
    vi.mocked(prisma.chamado.findFirst).mockResolvedValue(null as any)
    vi.mocked(prisma.chamado.create).mockResolvedValue({
      id: 'chamado-1',
      protocolo: 'CH-20261008-0001',
      unidade: 'E.E. TESTE',
      solicitante: 'Maria Silva',
      tipo: 'Rede',
      descricao: 'Sem conexão na sala 5',
      urgencia: 'Média',
      anexoUrl: null,
      status: 'ABERTO',
      timestamp: new Date(),
      tecnicoSetor: 'TECNICO1'
    } as any)
  })

  it('grava as respostas do formulário e os anexos da abertura', async () => {
    vi.mocked(prisma.formularioCategoria.findFirst).mockResolvedValue(REDE as any)

    const res = await request(app)
      .post('/api/chamados')
      .send({
        ...PAYLOAD_BASE,
        categoriaChave: 'rede',
        respostas: [{ perguntaId: 'p1', resposta: 'Lentidão' }],
        anexos: [
          { nome: 'sala5.jpg', tipo: 'image/jpeg', base64: 'AAA' },
          { nome: 'teste-velocidade.png', tipo: 'image/png', base64: 'BBB' }
        ]
      })

    expect(res.status).toBe(201)

    const data = vi.mocked(prisma.chamado.create).mock.calls[0][0].data as any
    expect(data.formularioRespostas).toEqual([
      { perguntaId: 'p1', rotulo: 'Qual é o problema de rede?', resposta: 'Lentidão' }
    ])
    // `anexoUrl` continua sendo o primeiro, para as telas antigas não mudarem.
    expect(data.anexoUrl).toMatch(/^https:\/\/storage\.test\/CH-\d{8}-\d{4}\/sala5\.jpg$/)
    expect(data.anexos.create).toHaveLength(2)
    // 201 volta com o que de fato subiu.
    expect(res.body.anexos.map((a: any) => a.nome)).toEqual(['sala5.jpg', 'teste-velocidade.png'])
  })

  it('cobra resposta da pergunta obrigatória visível', async () => {
    vi.mocked(prisma.formularioCategoria.findFirst).mockResolvedValue(REDE as any)

    const res = await request(app)
      .post('/api/chamados')
      .send({
        ...PAYLOAD_BASE,
        categoriaChave: 'rede',
        respostas: [{ perguntaId: 'p1', resposta: 'Queda total de internet' }]
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
    expect(res.body.details.respostas[0]).toContain('energia elétrica')
    expect(prisma.chamado.create).not.toHaveBeenCalled()
  })

  it('responde 422 quando a resposta escolhida manda parar o fluxo', async () => {
    vi.mocked(prisma.formularioCategoria.findFirst).mockResolvedValue(REDE as any)

    const res = await request(app)
      .post('/api/chamados')
      .send({
        ...PAYLOAD_BASE,
        categoriaChave: 'rede',
        respostas: [
          { perguntaId: 'p1', resposta: 'Queda total de internet' },
          { perguntaId: 'p2', resposta: 'Não, está sem energia no momento' }
        ]
      })

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('FORMULARIO_ENCERRADO')
    expect(res.body.message).toBe('Aguarde o retorno da energia.')
    expect(prisma.chamado.create).not.toHaveBeenCalled()
  })

  it('cobra o anexo que a resposta escolhida exige', async () => {
    vi.mocked(prisma.formularioCategoria.findFirst).mockResolvedValue(REDE as any)
    const respostas = [{ perguntaId: 'p1', resposta: 'Solicitação de pontos de rede' }]

    const semAnexo = await request(app)
      .post('/api/chamados')
      .send({ ...PAYLOAD_BASE, categoriaChave: 'rede', respostas })

    expect(semAnexo.status).toBe(400)
    expect(semAnexo.body.details.anexos).toBeDefined()
    expect(prisma.chamado.create).not.toHaveBeenCalled()

    const comAnexo = await request(app)
      .post('/api/chamados')
      .send({
        ...PAYLOAD_BASE,
        categoriaChave: 'rede',
        respostas,
        anexos: [{ nome: 'sala5.jpg', tipo: 'image/jpeg', base64: 'AAA' }]
      })

    expect(comAnexo.status).toBe(201)
  })

  it('NÃO valida condições para cliente antigo (manda categoriaChave, sem respostas)', async () => {
    vi.mocked(prisma.formularioCategoria.findFirst).mockResolvedValue(REDE as any)

    const res = await request(app)
      .post('/api/chamados')
      .send({ ...PAYLOAD_BASE, categoriaChave: 'rede' })

    expect(res.status).toBe(201)
    expect(prisma.formularioCategoria.findFirst).not.toHaveBeenCalled()
    const data = vi.mocked(prisma.chamado.create).mock.calls[0][0].data as any
    expect(data.formularioRespostas).toBe(Prisma.DbNull)
  })

  it('NÃO valida condições quando a categoria não existe mais', async () => {
    vi.mocked(prisma.formularioCategoria.findFirst).mockResolvedValue(null as any)

    const res = await request(app)
      .post('/api/chamados')
      .send({
        ...PAYLOAD_BASE,
        categoriaChave: 'categoria-apagada',
        respostas: [{ perguntaId: 'p1', resposta: 'qualquer coisa' }]
      })

    expect(res.status).toBe(201)
    const data = vi.mocked(prisma.chamado.create).mock.calls[0][0].data as any
    expect(data.formularioRespostas).toBe(Prisma.DbNull)
  })

  it('aceita o anexo único do formulário antigo (anexoBase64 no topo)', async () => {
    const res = await request(app)
      .post('/api/chamados')
      .send({
        ...PAYLOAD_BASE,
        anexoNome: 'print.jpg',
        anexoTipo: 'image/jpeg',
        anexoBase64: 'AAA'
      })

    expect(res.status).toBe(201)
    const data = vi.mocked(prisma.chamado.create).mock.calls[0][0].data as any
    expect(data.anexoUrl).toContain('print.jpg')
    expect(data.anexos.create).toHaveLength(1)
  })

  it('recusa anexos fora da lista e anexo grande demais', async () => {
    const naoLista = await request(app)
      .post('/api/chamados')
      .send({ ...PAYLOAD_BASE, anexos: 'foto.jpg' })
    expect(naoLista.status).toBe(400)
    expect(naoLista.body.details.anexos).toBeDefined()

    const grandes = await request(app)
      .post('/api/chamados')
      .send({
        ...PAYLOAD_BASE,
        anexos: Array.from({ length: 6 }, (_v, i) => ({ nome: `f${i}.jpg`, base64: 'AAA' }))
      })
    expect(grandes.status).toBe(400)

    const grande = await request(app)
      .post('/api/chamados')
      .send({ ...PAYLOAD_BASE, anexos: [{ nome: 'gigante.jpg', base64: 'A'.repeat(8 * 1024 * 1024) }] })
    expect(grande.status).toBe(400)

    expect(prisma.chamado.create).not.toHaveBeenCalled()
  })

  it('recusa respostas fora da lista', async () => {
    const res = await request(app)
      .post('/api/chamados')
      .send({ ...PAYLOAD_BASE, respostas: { perguntaId: 'p1' } })

    expect(res.status).toBe(400)
    expect(res.body.details.respostas).toBeDefined()
    expect(prisma.chamado.create).not.toHaveBeenCalled()
  })
})