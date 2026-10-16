import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../config/prisma'
import {
  SEPARADOR,
  montarEscopo,
  quebrarEscopo,
  tiposDoUsuario,
  temEscopo,
  prefixoDoTipo,
  clauseDeEscopo,
  casaComEscopo,
  casaComPrefixos,
  prefixosDoUsuario,
  escoposInvalidos,
  categoriaExigeLiberacao,
  chaveDaCategoria,
  exigeLiberacao,
  liberouCategoria,
  podeReceberChamado,
  filtrarPorEscopo,
} from './escopo'

vi.mock('../config/prisma', () => ({
  prisma: {
    formularioCategoria: {
      findMany: vi.fn(),
    },
    formularioPergunta: {
      findFirst: vi.fn(),
    },
  },
}))

const mockCategorias = vi.mocked(prisma.formularioCategoria.findMany)
const mockPergunta = vi.mocked(prisma.formularioPergunta.findFirst)

/** Categorias do formulário real (nomes que definem o `tipo` do chamado). */
const CATEGORIAS = [
  { chave: 'rede', nome: 'Rede' },
  { chave: 'equipamento', nome: 'Equipamento' },
  { chave: 'sistemas', nome: 'Sistemas' },
  { chave: 'email', nome: 'E-mail institucional' },
]

beforeEach(() => {
  vi.clearAllMocks()
  // `args?.where` porque `chaveDaCategoria` lista as categorias SEM filtro, no
  // caminho dos chamados antigos que não gravaram a chave.
  mockCategorias.mockImplementation(async (args: any) => {
    const chaves = args?.where?.chave?.in as string[] | undefined
    return CATEGORIAS.filter((c) => !chaves || chaves.includes(c.chave))
  })
  mockPergunta.mockResolvedValue({ id: 'p1' } as any)
})

describe('montarEscopo / quebrarEscopo', () => {
  it('monta chave::rótulo', () => {
    expect(montarEscopo('sistemas', 'PortalNet')).toBe(`sistemas${SEPARADOR}PortalNet`)
  })

  it('categoria inteira tem rótulo vazio', () => {
    expect(montarEscopo('email')).toBe(`email${SEPARADOR}`)
    expect(montarEscopo('email', '   ')).toBe(`email${SEPARADOR}`)
  })

  it('ignora separador que aparece no rótulo (usa o primeiro)', () => {
    const quebrado = quebrarEscopo(`sistemas${SEPARADOR}A - B`)
    expect(quebrado).toEqual({ chave: 'sistemas', rotulo: 'A - B' })
  })

  it('devolve null para valor sem separador ou sem chave', () => {
    expect(quebrarEscopo('sistemas')).toBeNull()
    expect(quebrarEscopo(`${SEPARADOR}PortalNet`)).toBeNull()
  })

  it('tipo com rótulo vazio é a categoria', () => {
    expect(quebrarEscopo(`email${SEPARADOR}`)).toEqual({ chave: 'email', rotulo: '' })
  })
})

describe('temEscopo', () => {
  it('array vazio, ausente ou null = SEM restrição', () => {
    expect(temEscopo({ escopoTipos: [] })).toBe(false)
    expect(temEscopo({ escopoTipos: undefined })).toBe(false)
    expect(temEscopo({ escopoTipos: null })).toBe(false)
    expect(temEscopo(undefined)).toBe(false)
  })

  it('lista preenchida = restrito', () => {
    expect(temEscopo({ escopoTipos: ['sistemas::PortalNet'] })).toBe(true)
  })

  it('lista só com valores malformados não restringe nada', () => {
    // Um escopo que não resolve casaria com NADA — vale mais como "sem
    // restrição" (usuário vê tudo) do que como usuário sem chamado nenhum.
    expect(temEscopo({ escopoTipos: ['lixo'] })).toBe(false)
  })

  it('descarta valores malformados da lista', () => {
    expect(tiposDoUsuario({ escopoTipos: ['lixo', 'sistemas::SEI'] })).toEqual([
      { chave: 'sistemas', rotulo: 'SEI' },
    ])
  })
})

describe('prefixoDoTipo', () => {
  it('monta "<categoria> - <opção>"', () => {
    expect(prefixoDoTipo('Sistemas', 'PortalNet')).toBe('Sistemas - PortalNet')
  })

  it('categoria inteira monta só o nome', () => {
    expect(prefixoDoTipo('E-mail institucional', '')).toBe('E-mail institucional')
  })

  it('trunca em 100, como o `tipo` gravado na criação', () => {
    const prefixo = prefixoDoTipo('Categoria', 'x'.repeat(200))
    expect(prefixo).toHaveLength(100)
  })
})

describe('clauseDeEscopo', () => {
  it('escopo vazio não gera restrição', async () => {
    expect(await clauseDeEscopo([])).toBeNull()
  })

  it('gera igualdade + " - " à frente, nunca startsWith solto', async () => {
    expect(await clauseDeEscopo(['sistemas::SEI'])).toEqual({
      OR: [
        {
          OR: [
            { tipo: { equals: 'Sistemas - SEI', mode: 'insensitive' } },
            { tipo: { startsWith: 'Sistemas - SEI - ', mode: 'insensitive' } },
          ],
        },
      ],
    })
  })

  it('as opções do escopo são alternativas entre si, nunca cumulativas', async () => {
    const restricao = await clauseDeEscopo(['sistemas::PortalNet', 'sistemas::SEI'])
    expect(restricao).not.toBeNull()
    expect(Object.keys(restricao as object)).toEqual(['OR'])
    expect((restricao as any).OR).toHaveLength(2)
  })

  it('categoria inteira casa pelo nome, com ou sem sufixo', async () => {
    expect(await clauseDeEscopo(['email::'])).toEqual({
      OR: [
        {
          OR: [
            { tipo: { equals: 'E-mail institucional', mode: 'insensitive' } },
            { tipo: { startsWith: 'E-mail institucional - ', mode: 'insensitive' } },
          ],
        },
      ],
    })
  })

  it('categoria inexistente não gera restrição', async () => {
    expect(await clauseDeEscopo(['inexistente::X'])).toBeNull()
  })
})

describe('casaComPrefixos', () => {
  const sistemas = ['Sistemas - PortalNet', 'Sistemas - SEI']

  it('casa o tipo exato', () => {
    expect(casaComPrefixos('Sistemas - SEI', sistemas)).toBe(true)
  })

  it('casa quando o chamado tem mais detalhe depois do tipo', () => {
    expect(casaComPrefixos('Sistemas - SEI - something', sistemas)).toBe(true)
  })

  it('NÃO casa com tipo que só começa igual (SEI vs SEIplus)', () => {
    // O erro clássico do startsWith sem " - ": traria chamado de outro tipo.
    expect(casaComPrefixos('Sistemas - SEIplus', sistemas)).toBe(false)
    expect(casaComPrefixos('Sistemas - PortalNet extra', sistemas)).toBe(false)
  })

  it('casa ignorando caixa e espaços extras', () => {
    expect(casaComPrefixos('  sistemas   -  sei ', sistemas)).toBe(true)
  })

  it('não casa com tipo vazio', () => {
    expect(casaComPrefixos('', sistemas)).toBe(false)
    expect(casaComPrefixos(null, sistemas)).toBe(false)
  })

  it('sem prefixo, não casa', () => {
    expect(casaComPrefixos('Sistemas - SEI', [])).toBe(false)
  })
})

describe('prefixosDoUsuario / casaComEscopo', () => {
  const usuario = { filial: 'E.E. A', escopoTipos: ['sistemas::PortalNet', 'email::'] }

  it('resolve os prefixos a partir das categorias', async () => {
    expect(await prefixosDoUsuario(usuario)).toEqual(['Sistemas - PortalNet', 'E-mail institucional'])
  })

  it('usuário sem escopo: casa com tudo (quem limita é a unidade)', async () => {
    expect(await casaComEscopo({ tipo: 'Rede - Lentidão' }, { filial: 'E.E. A', escopoTipos: [] })).toBe(true)
    expect(await casaComEscopo({ tipo: 'Qualquer coisa' }, undefined)).toBe(true)
  })

  it('dentro do escopo: casa', async () => {
    expect(await casaComEscopo({ tipo: 'Sistemas - PortalNet' }, usuario)).toBe(true)
    // Categoria inteira marcada cobre qualquer tipo dela
    expect(await casaComEscopo({ tipo: 'E-mail institucional' }, usuario)).toBe(true)
  })

  it('fora do escopo: NÃO casa', async () => {
    expect(await casaComEscopo({ tipo: 'Rede - Lentidão' }, usuario)).toBe(false)
    expect(await casaComEscopo({ tipo: 'Sistemas - PortalNet 2' }, usuario)).toBe(false)
  })

  it('chamado sem tipo nunca casa com escopo preenchido', async () => {
    expect(await casaComEscopo({ tipo: null }, usuario)).toBe(false)
  })
})

describe('escoposInvalidos', () => {
  it('aceita categoria inteira sem consultar pergunta', async () => {
    expect(await escoposInvalidos(['email::'])).toEqual([])
    expect(mockPergunta).not.toHaveBeenCalled()
  })

  it('aceita opção que existe', async () => {
    expect(await escoposInvalidos(['sistemas::PortalNet'])).toEqual([])
    expect(mockPergunta).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          categoria: { chave: 'sistemas' },
          tipo: 'OPCOES',
          opcoes: { array_contains: [{ rotulo: 'PortalNet' }] },
        }),
      }),
    )
  })

  it('recusa opção que não existe mais no formulário', async () => {
    // Renomear a opção no Configurações deixa o escopo órfão: recusar aqui
    // impede o usuário de ficar achando que está restrito quando vê tudo.
    mockPergunta.mockResolvedValue(null as any)
    expect(await escoposInvalidos(['sistemas::PortalNet'])).toEqual(['sistemas::PortalNet'])
  })

  it('recusa categoria inexistente e valor malformado', async () => {
    expect(await escoposInvalidos(['fantasia::X', 'sem-separador'])).toEqual([
      'fantasia::X',
      'sem-separador',
    ])
  })

  it('lista vazia não tem nada inválido', async () => {
    expect(await escoposInvalidos([])).toEqual([])
  })
})

/**
 * CATEGORIAS COM LIBERACAO — Sistemas e E-mail so chegam a quem as marcou no
 * perfil. E a excecao que cria: a regra da lista vazia ("sem escopo = sem
 * restricao") continua valendo para VER chamado e para as outras categorias.
 */
describe('categorias com liberacao', () => {
  it('so Sistemas e E-mail exigem liberacao', () => {
    expect(categoriaExigeLiberacao('sistemas')).toBe(true)
    expect(categoriaExigeLiberacao('email')).toBe(true)
    // Grafia com hifen, e a chave do cadastro vem em caixa que nao importa.
    expect(categoriaExigeLiberacao('e-mail')).toBe(true)
    expect(categoriaExigeLiberacao('SISTEMAS')).toBe(true)
    expect(categoriaExigeLiberacao('rede')).toBe(false)
    expect(categoriaExigeLiberacao('equipamento')).toBe(false)
    expect(categoriaExigeLiberacao('')).toBe(false)
  })

  describe('chaveDaCategoria', () => {
    it('usa a chave gravada na criacao, sem consultar o formulario', async () => {
      expect(await chaveDaCategoria({ tipo: 'Sistemas - PortalNet', categoriaChave: 'sistemas' })).toBe('sistemas')
      expect(mockCategorias).not.toHaveBeenCalled()
    })

    it('chamado antigo: acha a categoria pelo nome com que o tipo comeca', async () => {
      expect(await chaveDaCategoria({ tipo: 'Sistemas - PortalNet' })).toBe('sistemas')
      expect(await chaveDaCategoria({ tipo: 'E-mail institucional' })).toBe('email')
      expect(await chaveDaCategoria({ tipo: 'Rede - Lentidão' })).toBe('rede')
    })

    it('"Equip. - Sistema" e equipamento, nao sistemas', async () => {
      expect(await chaveDaCategoria({ tipo: 'Equipamento - Sistema operacional' })).toBe('equipamento')
    })

    it('tipo vazio ou desconhecido devolve vazio', async () => {
      expect(await chaveDaCategoria({ tipo: null })).toBe('')
      expect(await chaveDaCategoria({ tipo: 'Categoria Que Nao Existe' })).toBe('')
    })
  })

  it('exigeLiberacao pergunta a chave, inclusive nos chamados antigos', async () => {
    expect(await exigeLiberacao({ tipo: 'Sistemas - PortalNet', categoriaChave: 'sistemas' })).toBe(true)
    expect(await exigeLiberacao({ tipo: 'Sistemas - PortalNet' })).toBe(true)
    expect(await exigeLiberacao({ tipo: 'E-mail institucional' })).toBe(true)
    expect(await exigeLiberacao({ tipo: 'Rede - Lentidão', categoriaChave: 'rede' })).toBe(false)
  })

  describe('liberouCategoria', () => {
    const usuario = { escopoTipos: ['sistemas::PortalNet', 'sistemas::SEI', 'email::'] }

    it('vale qualquer um dos tipos marcados da categoria', () => {
      expect(liberouCategoria(usuario, 'sistemas')).toBe(true)
      expect(liberouCategoria(usuario, 'email')).toBe(true)
    })

    it('categoria nao marcada, escopo vazio ou usuario inexistente: nao liberou', () => {
      expect(liberouCategoria(usuario, 'rede')).toBe(false)
      expect(liberouCategoria({ escopoTipos: [] }, 'sistemas')).toBe(false)
      expect(liberouCategoria(undefined, 'sistemas')).toBe(false)
      expect(liberouCategoria(usuario, '')).toBe(false)
    })

    it('"e-mail" e outra categoria, nao outra grafia de "email"', () => {
      // O alias existe para RECUSAR a categoria sem liberacao; para casar com o
      // que o ADMIN marcou, vale a chave de verdade que o cadastro gravou.
      expect(categoriaExigeLiberacao('e-mail')).toBe(true)
      expect(liberouCategoria(usuario, 'e-mail')).toBe(false)
    })
  })

  describe('podeReceberChamado', () => {
    const deSistemas = { filial: 'URE Leste 3', escopoTipos: ['sistemas::PortalNet'] }
    const semEscopo = { filial: 'E.E. A', escopoTipos: [] }
    const soRede = { filial: 'E.E. A', escopoTipos: ['rede::Lentidão'] }

    it('categoria com liberacao: quem nao marcou nao recebe', async () => {
      expect(await podeReceberChamado({ tipo: 'Sistemas - PortalNet', categoriaChave: 'sistemas' }, semEscopo)).toBe(false)
      expect(await podeReceberChamado({ tipo: 'Rede - Lentidão', categoriaChave: 'rede' }, soRede)).toBe(true)
    })

    it('categoria com liberacao: quem marcou recebe', async () => {
      expect(await podeReceberChamado({ tipo: 'Sistemas - PortalNet', categoriaChave: 'sistemas' }, deSistemas)).toBe(true)
    })

    it('categoria com liberacao: escopo de outro assunto nao libera', async () => {
      expect(await podeReceberChamado({ tipo: 'Sistemas - PortalNet', categoriaChave: 'sistemas' }, soRede)).toBe(false)
    })

    it('categoria comum: a lista vazia continua significando "atende tudo"', async () => {
      expect(await podeReceberChamado({ tipo: 'Rede - Lentidão', categoriaChave: 'rede' }, semEscopo)).toBe(true)
      expect(await podeReceberChamado({ tipo: 'Equipamento - Formatação', categoriaChave: 'equipamento' }, undefined)).toBe(true)
    })

    it('escopo preenchido barra o tipo de fora, liberada ou nao', async () => {
      expect(await podeReceberChamado({ tipo: 'Equipamento - Formatação', categoriaChave: 'equipamento' }, soRede)).toBe(false)
    })

    it('liberadaJaResolvida pula a consulta de resolver a categoria', async () => {
      // Sem o atalho, o caminho do chamado antigo faz duas consultas: uma para
      // descobrir a categoria e outra (dentro de casaComEscopo) para os prefixos.
      // Com ele, só a segunda — é o que permite chamar isto num laço de candidatos.
      await podeReceberChamado({ tipo: 'Sistemas - PortalNet' }, deSistemas)
      const semAtalho = mockCategorias.mock.calls.length

      mockCategorias.mockClear()
      await podeReceberChamado({ tipo: 'Sistemas - PortalNet' }, deSistemas, true)
      expect(mockCategorias.mock.calls.length).toBe(semAtalho - 1)
    })
  })

  describe('filtrarPorEscopo', () => {
    const deSistemas = { id: 1, escopoTipos: ['sistemas::PortalNet'] }
    const semEscopo = { id: 2, escopoTipos: [] }

    it('categoria comum sem ninguem com escopo: sai tudo', async () => {
      expect(await filtrarPorEscopo({ tipo: 'Rede - Lentidão', categoriaChave: 'rede' }, [semEscopo], (c) => c)).toEqual([semEscopo])
    })

    it('categoria com liberacao sem ninguem com escopo: sai ninguem', async () => {
      // O desfecho que a regra da lista vazia produziria errado: devolver
      // "todos" colocaria o chamado de sistemas na mao de qualquer volante.
      expect(await filtrarPorEscopo({ tipo: 'Sistemas - PortalNet', categoriaChave: 'sistemas' }, [semEscopo], (c) => c)).toEqual([])
    })

    it('categoria comum: escopo preenchido continua barrando o tipo de fora', async () => {
      const resultado = await filtrarPorEscopo({ tipo: 'Rede - Lentidão', categoriaChave: 'rede' }, [deSistemas, semEscopo], (c) => c)
      expect(resultado).toEqual([semEscopo])
    })

    it('categoria com liberacao: fica quem marcou', async () => {
      const resultado = await filtrarPorEscopo({ tipo: 'Sistemas - PortalNet', categoriaChave: 'sistemas' }, [deSistemas, semEscopo], (c) => c)
      expect(resultado).toEqual([deSistemas])
    })
  })
})