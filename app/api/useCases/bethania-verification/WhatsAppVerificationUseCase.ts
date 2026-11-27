import "server-only"
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto"
import { whatsappVerificationRepository } from "@/app/api/infra/data/repositories/bethania-verification/PrismaWhatsAppVerificationRepository"
import { backofficeBethaniaUseCase } from "@/app/api/useCases/backofficeBethania/BackofficeBethaniaUseCase"
import { sendBethaniaTransportEvent } from "@/lib/bethania/signed-sender-client"
import { isWhatsAppChallengeUsable, MAX_WHATSAPP_VERIFICATION_ATTEMPTS, WHATSAPP_VERIFICATION_CODE_TTL_MS } from "@/lib/bethania/verification-policy"
import { Output } from "@/lib/output"
import type { WhatsAppVerificationRepository } from "./WhatsAppVerificationRepository"

const GENERIC_INVALID = "Código inválido ou expirado."
const GENERIC_SEND_FAILURE = "Não foi possível enviar o código. Tente novamente."

type Sender = typeof sendBethaniaTransportEvent
type RequestResult =
  | { ok: true; challengeId: string }
  | { ok: false; message: string; status: 400 | 429 | 503 }
type VerifyResult = { ok: true } | { ok: false; message: string }
type Options = {
  secret?: string
  now?: () => Date
  randomCode?: () => string
  randomChallengeId?: () => string
  getSenderUrl?: () => Promise<string | null>
}
type ExecuteInput =
  | { action: "request-code"; supabaseId: string; phone: unknown }
  | { action: "verify-code"; supabaseId: string; challengeId: string; code: unknown }

export function normalizeWhatsAppPhone(value: unknown): string | null {
  if (typeof value !== "string") return null
  const compact = value.trim().replace(/[\s().-]/g, "")
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null
}

function hashCode(
  secret: string,
  accountId: string,
  phone: string,
  challengeId: string,
  code: string,
) {
  return createHmac("sha256", secret)
    .update(`${accountId}.${phone}.${challengeId}.${code}`)
    .digest("hex")
}

export class WhatsAppVerificationUseCase {
  private readonly secret: string
  private readonly now: () => Date
  private readonly randomCode: () => string
  private readonly randomChallengeId: () => string
  private readonly getSenderUrl: () => Promise<string | null>

  constructor(
    private readonly repository: WhatsAppVerificationRepository,
    private readonly sender: Sender,
    options: Options = {},
  ) {
    this.secret = options.secret ?? process.env.BETHANIA_VERIFICATION_SECRET ?? ""
    if (Buffer.byteLength(this.secret, "utf8") < 32 || !this.secret.trim())
      throw new Error("BETHANIA_VERIFICATION_SECRET must be configured")
    this.now = options.now ?? (() => new Date())
    this.randomCode = options.randomCode ?? (() => String(randomInt(0, 1_000_000)).padStart(6, "0"))
    this.randomChallengeId = options.randomChallengeId ?? randomUUID
    this.getSenderUrl = options.getSenderUrl ?? (async () => null)
  }

  async execute(input: ExecuteInput): Promise<Output> {
    if (input.action === "request-code") {
      const result = await this.requestCode(input.supabaseId, input.phone)
      return result.ok
        ? new Output(true, [], [], { challengeId: result.challengeId, status: 202 })
        : new Output(false, [], [result.message], { status: result.status })
    }
    const result = await this.verifyCode(input.supabaseId, input.challengeId, input.code)
    return result.ok
      ? new Output(true, [], [], { status: 200 })
      : new Output(false, [], [result.message], { status: 400 })
  }

  async requestCode(supabaseId: string, rawPhone: unknown): Promise<RequestResult> {
    const phone = normalizeWhatsAppPhone(rawPhone)
    if (!phone) return { ok: false, message: "Número de WhatsApp inválido.", status: 400 }
    try {
      const now = this.now()
      const code = this.randomCode()
      const challengeId = this.randomChallengeId()
      const challenge = await this.repository.issueChallenge({
        supabaseId,
        id: challengeId,
        phone,
        codeHash: hashCode(this.secret, supabaseId, phone, challengeId, code),
        createdAt: now,
        expiresAt: new Date(now.getTime() + WHATSAPP_VERIFICATION_CODE_TTL_MS),
      })
      if (!challenge) return { ok: false, message: GENERIC_SEND_FAILURE, status: 429 }
      try {
        const baseUrl = await this.getSenderUrl()
        if (!baseUrl) throw new Error("Bethânia sender URL is not configured")
        await this.sender(
          {
            eventId: challenge.id,
            eventType: "account.whatsapp_verification",
            phone: challenge.phone,
            message: `Seu código de verificação Bethânia é ${code}. Ele expira em 10 minutos.`,
          },
          {
            baseUrl,
            secret: process.env.BETHANIA_SENDER_SECRET ?? "",
          },
        )
      } catch {
        await this.repository.invalidateChallenge(challenge.id, this.now())
        return { ok: false, message: GENERIC_SEND_FAILURE, status: 503 }
      }
      return { ok: true, challengeId: challenge.id }
    } catch {
      return { ok: false, message: GENERIC_SEND_FAILURE, status: 503 }
    }
  }

  async verifyCode(supabaseId: string, challengeId: string, code: unknown): Promise<VerifyResult> {
    if (typeof code !== "string" || !/^\d{6}$/.test(code))
      return { ok: false, message: GENERIC_INVALID }
    try {
      const challenge = await this.repository.findChallenge(supabaseId, challengeId)
      const now = this.now()
      if (!challenge || !isWhatsAppChallengeUsable(challenge, now))
        return { ok: false, message: GENERIC_INVALID }

      const expected = Buffer.from(challenge.codeHash, "hex")
      const actual = Buffer.from(
        hashCode(this.secret, supabaseId, challenge.phone, challenge.id, code),
        "hex",
      )
      const matches = expected.length === actual.length && timingSafeEqual(expected, actual)
      if (!matches) {
        await this.repository.incrementFailedAttempt({
          supabaseId,
          id: challenge.id,
          expectedAttempts: challenge.attempts,
          now,
        })
        return { ok: false, message: GENERIC_INVALID }
      }

      const consumed = await this.repository.consumeAndSetPhone({
        supabaseId,
        id: challenge.id,
        phone: challenge.phone,
        expectedAttempts: challenge.attempts,
        maxAttempts: MAX_WHATSAPP_VERIFICATION_ATTEMPTS,
        now,
      })
      return consumed ? { ok: true } : { ok: false, message: GENERIC_INVALID }
    } catch {
      return { ok: false, message: GENERIC_INVALID }
    }
  }
}

let defaultUseCase: WhatsAppVerificationUseCase | undefined
function getDefaultUseCase() {
  defaultUseCase ??= new WhatsAppVerificationUseCase(whatsappVerificationRepository, sendBethaniaTransportEvent, {
    getSenderUrl: () => backofficeBethaniaUseCase.getConfiguredSenderUrl(),
  })
  return defaultUseCase
}

export const whatsappVerificationUseCase = {
  execute: (input: ExecuteInput) => getDefaultUseCase().execute(input),
  requestCode: (supabaseId: string, phone: unknown) =>
    getDefaultUseCase().requestCode(supabaseId, phone),
  verifyCode: (supabaseId: string, challengeId: string, code: unknown) =>
    getDefaultUseCase().verifyCode(supabaseId, challengeId, code),
}
