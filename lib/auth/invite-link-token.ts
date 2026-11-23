import { createHmac, timingSafeEqual } from "node:crypto"

/** Mesmo prazo anunciado no e-mail de convite ("válido por 24 horas"). */
export const INVITE_LINK_TTL_SECONDS = 86_400

export interface InviteLinkPayload {
  email: string
  name: string | null
  expiresAt: number
}

function getInviteLinkSecret(): string {
  const secret = process.env.INVITE_LINK_SECRET?.trim()
  if (!secret || secret.length < 32) {
    throw new Error("INVITE_LINK_SECRET ausente ou com menos de 32 caracteres")
  }
  return secret
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url")
}

/**
 * Token assinado do convite de primeiro acesso. Não é um token do Supabase: não é
 * gravado no banco e não invalida nenhum outro token. O link continua válido até a
 * expiração ou até o usuário fazer o primeiro acesso (checado na troca, ver
 * `exchangeInviteLinkToken`).
 */
export function signInviteLinkToken(
  input: { email: string; name: string | null },
  options: { nowMs?: number; secret?: string } = {}
): string {
  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000)
  const payload = {
    e: input.email.trim().toLowerCase(),
    n: input.name,
    x: nowSeconds + INVITE_LINK_TTL_SECONDS,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${encoded}.${signPayload(encoded, options.secret ?? getInviteLinkSecret())}`
}

export function verifyInviteLinkToken(
  token: string,
  options: { nowMs?: number; secret?: string } = {}
): InviteLinkPayload | null {
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [encoded, signature] = parts
  if (!encoded || !signature) return null

  const expected = Buffer.from(signPayload(encoded, options.secret ?? getInviteLinkSecret()))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null

  const { e, n, x } = parsed as { e?: unknown; n?: unknown; x?: unknown }
  if (typeof e !== "string" || e.length === 0 || typeof x !== "number") return null

  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000)
  if (nowSeconds >= x) return null

  return { email: e, name: typeof n === "string" ? n : null, expiresAt: x }
}
