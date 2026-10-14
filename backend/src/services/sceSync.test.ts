import { describe, it, expect } from 'vitest'
import { filialParaSce } from './sceSync'

describe('filialParaSce', () => {
  it('escola solitária vai como está', () => {
    expect(filialParaSce('E.E. VILA BELA')).toBe('E.E. VILA BELA')
  })

  it('a irmã vira o grupo: o técnico enxerga o parque do prédio compartilhado', () => {
    expect(filialParaSce('E.E. LEILA DINIZ')).toBe('E.E. CESAR DONATO CALABREZ / LEILA DINIZ')
  })

  // Sem resolver unidade por unidade, a lista inteira ia como um bloco só e o
  // `grupoDaUnidade` não reconheceria nada: o técnico perderia o parque todo.
  it('lista do técnico: resolve cada unidade e mantém o separador', () => {
    expect(filialParaSce('E.E. LEILA DINIZ | E.E. VILA BELA')).toBe(
      'E.E. CESAR DONATO CALABREZ / LEILA DINIZ | E.E. VILA BELA',
    )
  })

  it('escola com vírgula no nome sobrevive intacta dentro da lista', () => {
    expect(filialParaSce('E.E. FERNANDO MAURO P. ROCHA, DEPUTADO | E.E. BERNARDIM RIBEIRO')).toBe(
      'E.E. FERNANDO MAURO P. ROCHA, DEPUTADO | E.E. BERNARDIM RIBEIRO',
    )
  })

  it('lista antiga separada por vírgula também é resolvida unidade por unidade', () => {
    expect(filialParaSce('E.E. VILA BELA, E.E. LEILA DINIZ')).toBe(
      'E.E. VILA BELA | E.E. CESAR DONATO CALABREZ / LEILA DINIZ',
    )
  })

  it('filial vazio não vira lista', () => {
    expect(filialParaSce('')).toBe('')
  })
})