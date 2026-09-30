import { describe, it, expect } from 'vitest'
import {
  filtroUnidadesDoUsuario,
  normalizarUnidade,
  unidadesDoUsuario,
  usuarioAtendeUnidade,
} from './unidades'

describe('unidades do usuário', () => {
  it('filial única vira lista de um item', () => {
    expect(unidadesDoUsuario('E.E. BELIZE')).toEqual(['E.E. BELIZE'])
  })

  it('filial do técnico com várias unidades vira lista', () => {
    expect(unidadesDoUsuario('E.E. BELIZE, E.E. JARDIM IGUATEMI , ')).toEqual([
      'E.E. BELIZE',
      'E.E. JARDIM IGUATEMI',
    ])
  })

  it('filial vazio não vira lista', () => {
    expect(unidadesDoUsuario('')).toEqual([])
    expect(unidadesDoUsuario(null)).toEqual([])
  })
})

describe('normalizarUnidade', () => {
  it('tira acento, "E.E." e honorífico', () => {
    expect(normalizarUnidade('E.E. Antônio Carlos Brasileiro de Almeida Jobim')).toBe('ANTONIO CARLOS BRASILEIRO DE ALMEIDA JOBIM')
    expect(normalizarUnidade('E.E. VILA BELA')).toBe('VILA BELA')
  })

  it('remove honorífico do final', () => {
    expect(normalizarUnidade('E.E. Zilda Vilanova Profa')).toBe('ZILDA VILANOVA')
  })
})

describe('usuarioAtendeUnidade', () => {
  it('técnico atende qualquer uma das unidades do seu filial', () => {
    const filial = 'E.E. BELIZE, E.E. JARDIM IGUATEMI'
    expect(usuarioAtendeUnidade(filial, 'E.E. BELIZE')).toBe(true)
    expect(usuarioAtendeUnidade(filial, 'E.E. JARDIM IGUATEMI')).toBe(true)
  })

  it('técnico NÃO atende unidade que não está na lista', () => {
    expect(usuarioAtendeUnidade('E.E. BELIZE, E.E. JARDIM IGUATEMI', 'E.E. VILA BELA')).toBe(false)
  })

  it('tolera acento, "E.E." e caixa', () => {
    expect(usuarioAtendeUnidade('E.E. SAO MIGUEL PAULISTA', 'E.E. São Miguel Paulista')).toBe(true)
  })

  it('irmãs: grupo composto casa com a unidade individual', () => {
    expect(usuarioAtendeUnidade('E.E. BELIZE / E.E. BENJAMIN SAMUEL BLOOM', 'E.E. BELIZE')).toBe(true)
    expect(usuarioAtendeUnidade('E.E. BELIZE', 'E.E. BELIZE / E.E. BENJAMIN SAMUEL BLOOM')).toBe(true)
  })

  it('unidade vazia nunca casa', () => {
    expect(usuarioAtendeUnidade('E.E. BELIZE', '')).toBe(false)
    expect(usuarioAtendeUnidade('', 'E.E. BELIZE')).toBe(false)
  })
})

describe('filtroUnidadesDoUsuario', () => {
  it('gera um contains por unidade (nunca a string inteira)', () => {
    const filtro = filtroUnidadesDoUsuario('E.E. BELIZE, E.E. JARDIM IGUATEMI')
    expect(filtro.OR).toHaveLength(2)
    expect((filtro.OR[0] as any).unidade.contains).toBe('BELIZE')
    expect((filtro.OR[1] as any).unidade.contains).toBe('JARDIM IGUATEMI')
  })

  it('usuário sem unidades não devolve filtro vazio (Listar tudo!)', () => {
    const filtro = filtroUnidadesDoUsuario('')
    expect(filtro.OR).toHaveLength(1)
  })
})
