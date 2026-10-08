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
  mockCategorias.mockImplementation(async ({ where }: any) => {
    const chaves = where?.chave?.in as string[] | undefined
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
  it('escopo vazio não gera cláusula', async () => {
    expect(await clauseDeEscopo([])).toEqual([])
  })

  it('gera igualdade + " - " à frente, nunca startsWith solto', async () => {
    const [clause] = await clauseDeEscopo(['sistemas::SEI'])
    expect(clause).toEqual({
      OR: [
        { tipo: { equals: 'Sistemas - SEI', mode: 'insensitive' } },
        { tipo: { startsWith: 'Sistemas - SEI - ', mode: 'insensitive' } },
      ],
    })
  })

  it('uma cláusula por tipo (as cláusulas entram em AND entre si)', async () => {
    const clauses = await clauseDeEscopo(['sistemas::PortalNet', 'sistemas::SEI'])
    expect(clauses).toHaveLength(2)
  })

  it('categoria inteira casa pelo nome, com ou sem sufixo', async () => {
    const [clause] = await clauseDeEscopo(['email::'])
    expect(clause).toEqual({
      OR: [
        { tipo: { equals: 'E-mail institucional', mode: 'insensitive' } },
        { tipo: { startsWith: 'E-mail institucional - ', mode: 'insensitive' } },
      ],
    })
  })

  it('categoria inexistente não vira cláusula que não casa nada', async () => {
    // Uma cláusula impossível zeraria a lista inteira do usuário silenciosamente.
    expect(await clauseDeEscopo(['inexistente::X'])).toEqual([])
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