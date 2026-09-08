import { randomBytes, createHash } from 'crypto'

export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateTempPassword(length = 12): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)]
  }
  return password
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