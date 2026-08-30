import { timingSafeEqual } from "node:crypto"

/**
 * Compara o token recebido no webhook do Asaas com o token esperado usando
 * `crypto.timingSafeEqual`, para não vazar o token por diferença de tempo de
 * resposta (S3 — [[01 — Auditoria Motor de Pagamentos ponta a ponta]] §10).
 *
 * `timingSafeEqual` lança quando os buffers têm comprimentos diferentes — por
 * isso o comprimento é comparado antes, e a função nunca lança: token errado
 * (de qualquer comprimento) ou ausente sempre retorna `false`.
 */
export function isValidAsaasWebhookToken(
  received: string,
  expected: string | undefined | null
): boolean {
  if (!expected) return false

  const receivedBuffer = Buffer.from(received, "utf8")
  const expectedBuffer = Buffer.from(expected, "utf8")

  if (receivedBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(receivedBuffer, expectedBuffer)
}
