import { describe, it, expect } from 'vitest'
import { grupoDaUnidade, listarUnidadesIndividuais, papelDaUnidade } from './normalization'

/**
 * O papel MÃE/FILHA habilita o acesso somente-leitura da escola FILHA aos
 * equipamentos compartilhados do grupo. Os pares abaixo são as 13 escolas
 * irmãs que dividem o mesmo prédio.
 */
const PARES_MAE_FILHA: Array<[string, string]> = [
  ['E.E. ANTONIETA DE SOUZA ALCÂNTARA', 'E.E. CHARLOTTE MARIA SHAW MASON'],
  ['E.E. AQUILINO RIBEIRO', 'E.E. MARIA TEREZA SIMÕES DE ALMEIDA PROFESSORA'],
  ['E.E. BARRO BRANCO II', 'E.E. LEÔNIDAS DA SILVA'],
  ['E.E. BELIZE', 'E.E. BENJAMIN SAMUEL BLOOM'],
  ['E.E. CARMELINDA M. PEREIRA', 'E.E. LIMA BARRETO'],
  ['E.E. CESAR DONATO CALABREZ', 'E.E. LEILA DINIZ'],
  ['E.E. CLAUDIA DUTRA VIANA', 'E.E. ROSA PARKS'],
  ['E.E. DÉCIO FERRAZ ALVIM', 'E.E. FLORIANO PEIXOTO'],
  ['E.E. GERALDINO DOS SANTOS, DEPUTADO', 'E.E. JOSUÉ DE CASTRO'],
  ['E.E. JARDIM PEDRA BRANCA', 'E.E. PATRÍCIA GALVÃO - PAGU'],
  ['E.E. MARCOS ANTONIO COSTA', 'E.E. HERBERT JOSÉ DE SOUZA - BETINHO'],
  ['E.E. MARIA DE LOURDES A. A. PACHECO', 'E.E. CHIQUINHA GONZAGA'],
  ['E.E. RECANTO VERDE SOL', 'E.E. DJANIRA'],
]

describe('papelDaUnidade', () => {
  it('classifica a primeira escola do grupo como MÃE', () => {
    for (const [mae] of PARES_MAE_FILHA) {
      expect(papelDaUnidade(mae), mae).toBe('MAE')
    }
  })

  it('classifica a escola irmã como FILHA', () => {
    for (const [, filha] of PARES_MAE_FILHA) {
      expect(papelDaUnidade(filha), filha).toBe('FILHA')
    }
  })

  it('cobre todas as escolas irmãs cadastradas na lista-mestra', () => {
    const comIrma = listarUnidadesIndividuais().filter((u) => u.irma !== null)
    const maes = comIrma.filter((u) => u.nome === u.grupo.split(' / ')[0].trim())
    const filhas = comIrma.filter((u) => u.nome !== u.grupo.split(' / ')[0].trim())
    expect(maes).toHaveLength(13)
    expect(filhas).toHaveLength(13)
    for (const u of maes) expect(papelDaUnidade(u.nome), u.nome).toBe('MAE')
    for (const u of filhas) expect(papelDaUnidade(u.nome), u.nome).toBe('FILHA')
  })

  it('devolve null para o grupo completo (não é uma unidade isolada)', () => {
    const grupo = listarUnidadesIndividuais().find((u) => u.irma !== null)!.grupo
    expect(papelDaUnidade(grupo)).toBeNull()
  })

  it('devolve null para unidade sem par', () => {
    expect(papelDaUnidade('E.E. ADHEMAR ANTONIO PRADO')).toBeNull()
  })

  it('devolve null para nome vazio ou fora do catálogo', () => {
    expect(papelDaUnidade('')).toBeNull()
    expect(papelDaUnidade('ESCOLA QUE NAO EXISTE')).toBeNull()
  })

  it('aceita grafia sem "E.E." e sem acento (legado)', () => {
    expect(papelDaUnidade('LEILA DINIZ')).toBe('FILHA')
    expect(papelDaUnidade('CESAR DONATO CALABREZ')).toBe('MAE')
    expect(papelDaUnidade('JOSE DE CASTRO')).toBeNull() // grafia divergente: não casa
  })
})

describe('grupoDaUnidade', () => {
  it('resolve o mesmo grupo a partir do nome da MÃE e da FILHA', () => {
    for (const [mae, filha] of PARES_MAE_FILHA) {
      const gMae = grupoDaUnidade(mae)
      const gFilha = grupoDaUnidade(filha)
      expect(gFilha, filha).toBe(gMae)
      expect(gMae.includes('/'), mae).toBe(true)
    }
  })

  it('devolve a própria unidade quando ela está sozinha', () => {
    expect(grupoDaUnidade('E.E. ADHEMAR ANTONIO PRADO')).toBe('E.E. ADHEMAR ANTONIO PRADO')
  })
})
