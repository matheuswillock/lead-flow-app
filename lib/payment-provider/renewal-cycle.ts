// Prazos gravados no perfil também vêm no vocabulário legado do provedor antigo.
const LEGACY_CYCLE_ALIASES: Readonly<Record<string, string>> = { semiannually: "semiannual", yearly: "annual" }

/** Prazo da assinatura no vocabulário da tabela de prazos do checkout, ou `null` quando ausente. */
export function normalizeRenewalCycle(raw: string | null | undefined): string | null {
  const normalized = raw?.trim().toLowerCase()
  if (!normalized) return null
  return LEGACY_CYCLE_ALIASES[normalized] ?? normalized
}
