export function getResendOwnerEmail(): string | null {
  const configured = process.env.RESEND_OWNER_EMAIL?.trim()
  if (configured) return configured

  console.error(
    "[resend-owner-email] RESEND_OWNER_EMAIL ausente; fallback de e-mail do owner desabilitado"
  )
  return null
}
