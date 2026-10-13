import { randomBytes, createHash } from 'crypto'

export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Senha temporária para a Matriz repassar a quem esqueceu a senha.
 *
 * Garante UM caractere de cada classe exigida pela política e preenche o resto
 * ao acaso. A versão anterior sorteava todos os caracteres do conjunto e
 * produzia senha inválida em ~metade dos casos — faltando especial ou número.
 * Na prática isso entregava à pessoa uma senha que a própria política recusaria
 * no momento da troca, prendendo quem dependia dela.
 *
 * A ordem não é aleatória de propósito: começa pelos caracteres obrigatórios e
 * só depois embaralha, para a posição deles não denunciar o padrão.
 */
export function generateTempPassword(length = 12): string {
  const MAIUSCULAS = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const MINUSCULAS = 'abcdefghjkmnpqrstuvwxyz'
  const NUMEROS = '23456789'
  const ESPECIAIS = '!@#$%'
  const RESTO = MAIUSCULAS + MINUSCULAS + NUMEROS + ESPECIAIS

  const escolher = (conjunto: string) => conjunto[Math.floor(Math.random() * conjunto.length)]

  // Um de cada classe obrigatória. O comprimento padrão é 12, bem acima dos 4
  // exigidos; abaixo disso não dá para cobrir as quatro classes e o comprimento
  // manda, então o comprimento é respeitado e a política decide.
  if (length < 4) {
    let curta = ''
    for (let i = 0; i < length; i++) curta += escolher(RESTO)
    return curta
  }

  const obrigatorios = [escolher(MAIUSCULAS), escolher(MINUSCULAS), escolher(NUMEROS), escolher(ESPECIAIS)]
  const resto: string[] = []
  for (let i = obrigatorios.length; i < length; i++) resto.push(escolher(RESTO))

  const senha = [...obrigatorios, ...resto]
  // Fisher-Yates: embaralha sem viés (sort por Math.random() sortearia).
  for (let i = senha.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[senha[i], senha[j]] = [senha[j], senha[i]]
  }
  return senha.join('')
}

export const passwordPolicy = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,

  validate(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (password.length < this.minLength) {
      errors.push(`Mínimo ${this.minLength} caracteres`)
    }
    if (password.length > this.maxLength) {
      errors.push(`Máximo ${this.maxLength} caracteres`)
    }
    if (this.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Pelo menos uma letra maiúscula')
    }
    if (this.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Pelo menos uma letra minúscula')
    }
    if (this.requireNumber && !/[0-9]/.test(password)) {
      errors.push('Pelo menos um número')
    }
    if (this.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Pelo menos um caractere especial (!@#$%^&*...)')
    }

    return { valid: errors.length === 0, errors }
  },

  generateTemp: generateTempPassword
}