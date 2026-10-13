/**
 * `generateTempPassword` precisa produzir senha que a PRÓPRIA política aceita.
 *
 * A versão anterior sorteava os caracteres do conjunto sem garantir uma de
 * cada classe exigida, e saía inválida em cerca de metade dos casos — faltando
 * especial ou número. Como essa senha é entregue à pessoa pela Matriz para ela
 * trocar, uma senha inválida prendia quem dependia dela: aceitava no login e
 * recusava na troca, sem explicação.
 *
 * O teste gera muitas senhas de propósito: uma amostra única passa 50% das
 * vezes mesmo com o defeito, e um teste que passa pela sorte não trava nada.
 */
import { describe, it, expect } from 'vitest'
import { generateTempPassword, passwordPolicy } from './tokens'

describe('generateTempPassword', () => {
  it('sempre gera senha que a política aceita (300 amostras)', () => {
    const reprovadas: { senha: string; erros: string[] }[] = []

    for (let i = 0; i < 300; i++) {
      const senha = generateTempPassword()
      const resultado = passwordPolicy.validate(senha)
      if (!resultado.valid) reprovadas.push({ senha, erros: resultado.errors })
    }

    expect(reprovadas, `senhas inválidas geradas: ${JSON.stringify(reprovadas.slice(0, 3))}`).toEqual([])
  })

  it('respeita o comprimento pedido', () => {
    expect(generateTempPassword(12)).toHaveLength(12)
    expect(generateTempPassword(16)).toHaveLength(16)
    // 8 é o mínimo da política.
    expect(generateTempPassword(8)).toHaveLength(8)
  })

  it('mantém o comprimento quando ele é menor que as quatro classes exigidas', () => {
    // Abaixo de 4 não dá para ter uma de cada classe. O comprimento pedido
    // manda; quem chama decide se aceita o resultado.
    expect(generateTempPassword(3)).toHaveLength(3)
  })

  it('não repete a senha (não é constante disfarçada)', () => {
    const senhas = new Set(Array.from({ length: 50 }, () => generateTempPassword()))
    expect(senhas.size).toBeGreaterThan(45)
  })

  it('embaralha: os caracteres obrigatórios não ficam sempre na mesma posição', () => {
    // Garante uma maiúscula, uma minúscula, um número e um especial em ordens
    // diferentes — senão a senha denunciaria o padrão de geração.
    const primeiraPosMaiuscula = new Set<number>()
    for (let i = 0; i < 60; i++) {
      const senha = generateTempPassword()
      primeiraPosMaiuscula.add(senha.search(/[A-Z]/))
    }
    expect(primeiraPosMaiuscula.size).toBeGreaterThan(3)
  })

  it('não usa caractere ambíguo (sem O/0, l/1)', () => {
    // A senha é repassada por telefone e ditada. 'O' e '0' são indistinguíveis
    // no ouvido e a pessoa erra a conta.
    for (let i = 0; i < 100; i++) {
      expect(generateTempPassword()).not.toMatch(/[O0lI]/)
    }
  })
})