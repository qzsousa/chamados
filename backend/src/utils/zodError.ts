import { ZodError } from 'zod'

/**
 * `instanceof ZodError` NÃO funciona de forma confiável aqui.
 *
 * Os schemas vêm do pacote linkado `@shared/api`, que traz a PRÓPRIA cópia do
 * zod em `shared/types/node_modules` — separada da que o backend importa. São
 * duas classes JavaScript diferentes com o mesmo nome: um `ZodError` lançado
 * pelo schema não é `instanceof` o `ZodError` do backend.
 *
 * O efeito era pior do que "a validação não foi reconhecida": o `catch` caía no
 * `throw err`, e o Express 4 não captura rejeição de handler `async` — a
 * requisição ficava pendurada sem responder nada (25 s até o cliente desistir),
 * em vez de devolver 400. Já aconteceu em 21 pontos; este helper é a checagem
 * única para todos.
 *
 * O nome da classe é o que sobrevive entre as cópias (`ZodError.name`), então
 * basta aceitá-lo. O `instanceof` continua no teste porque, no dia em que as
 * cópias se fundirem num workspace, ele passa a ser o que acerta.
 */
export function isZodError(err: unknown): err is ZodError {
  return err instanceof ZodError || (err as { name?: string } | null)?.name === 'ZodError'
}

/** Corpo de resposta 400 no formato que o portal já conhece. */
export function respostaValidacao(res: import('express').Response, err: ZodError) {
  return res.status(400).json({
    error: 'VALIDATION_ERROR',
    message: 'Dados inválidos',
    details: err.flatten().fieldErrors,
  })
}
