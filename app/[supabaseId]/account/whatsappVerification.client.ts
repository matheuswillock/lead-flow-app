import { resolveBethaniaSafeReturnPath } from "@/lib/bethania/safe-return-path"

type WhatsAppContact = {
  id?: string
  supabaseId?: string | null
  phone?: string | null
  whatsappPhone?: string | null
  whatsappPhoneVerifiedAt?: string | null
} | null | undefined

export function hasVerifiedWhatsAppContact(user: WhatsAppContact): boolean {
  return Boolean(user?.whatsappPhone && user.whatsappPhoneVerifiedAt)
}

export function getAccountReturnPath(
  candidate: string | null | undefined,
  supabaseId: string,
): string | null {
  return resolveBethaniaSafeReturnPath(candidate, supabaseId)
}

export function buildWhatsAppAccountPath(
  supabaseId: string,
  returnPath: string | null,
): string {
  const accountPath = `/${supabaseId}/account`
  if (!returnPath) return accountPath

  const params = new URLSearchParams({ returnTo: returnPath })
  return `${accountPath}?${params.toString()}`
}

export function shouldShowWhatsAppVerificationPrompt(
  user: WhatsAppContact,
  isLoading: boolean,
  pathname: string,
  supabaseId: string,
): boolean {
  return (
    !isLoading &&
    user?.supabaseId === supabaseId &&
    !hasVerifiedWhatsAppContact(user) &&
    pathname !== `/${supabaseId}/account`
  )
}
