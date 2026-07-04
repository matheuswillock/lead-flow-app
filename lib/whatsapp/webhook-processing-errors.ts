import { Prisma } from "@prisma/client"

export class WebhookPayloadRejectedError extends Error {
  readonly retryable = false
  constructor(message: string) {
    super(message)
    this.name = "WebhookPayloadRejectedError"
  }
}

const RETRYABLE_PRISMA_CODES = new Set(["P1001", "P1002", "P1008", "P1017"])

export function isRetryableWebhookError(error: unknown): boolean {
  if (error instanceof WebhookPayloadRejectedError) return false
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return false
    if (RETRYABLE_PRISMA_CODES.has(error.code)) return true
  }
  return true
}
