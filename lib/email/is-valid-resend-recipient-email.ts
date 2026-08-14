/**
 * Valida e-mail de destinatário no formato aceito pelo Resend
 * (`email@example.com`). Rejeita múltiplos endereços colados e formatos inválidos.
 *
 * Local-part alinhado a `atext` (RFC 5322), exceto `|` (usado como separador
 * de múltiplos endereços nos CSV/importações).
 */

const RESEND_EMAIL_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

export type ResendRecipientEmailValidation =
  | { ok: true; email: string }
  | { ok: false; reason: string }

export function normalizeResendRecipientEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidResendRecipientEmail(
  value: string | null | undefined
): ResendRecipientEmailValidation {
  const email = normalizeResendRecipientEmail(value ?? "")

  if (!email) {
    return { ok: false, reason: "E-mail ausente" }
  }

  if (/\s/.test(email)) {
    return { ok: false, reason: "E-mail contém espaços" }
  }

  if (/[|;,]/.test(email) || (email.match(/@/g) ?? []).length > 1) {
    return { ok: false, reason: "E-mail com múltiplos endereços" }
  }

  if (/[<>]/.test(email)) {
    return { ok: false, reason: "Formato de e-mail inválido" }
  }

  if (!RESEND_EMAIL_REGEX.test(email)) {
    return { ok: false, reason: "Formato de e-mail inválido" }
  }

  const atIndex = email.indexOf("@")
  const localPart = atIndex >= 0 ? email.slice(0, atIndex) : ""
  // Resend rejeita local-part com ponto no início/fim ou consecutivos (ex.: mjc.f.@…).
  if (
    !localPart ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  ) {
    return { ok: false, reason: "Formato de e-mail inválido" }
  }

  return { ok: true, email }
}

export function formatInvalidRecipientFailureMessage(
  email: string,
  reason: string
): string {
  return `E-mail inválido para o Resend: ${email} (${reason})`
}

export function formatProviderBatchFailureMessage(params: {
  message: string
  statusCode?: number
  emails: string[]
  sampleLimit?: number
}): string {
  const sampleLimit = params.sampleLimit ?? 10
  const sample = params.emails.slice(0, sampleLimit)
  const remaining = params.emails.length - sample.length
  const statusPrefix =
    typeof params.statusCode === "number" ? `${params.statusCode} — ` : ""
  const emailsPart =
    sample.length === 0
      ? ""
      : ` Destinatários do lote: ${sample.join(", ")}${
          remaining > 0 ? ` e mais ${remaining}` : ""
        }.`
  return `${statusPrefix}${params.message}.${emailsPart}`.replace(/\.\./g, ".")
}
