import type { AccountAccessRestrictionReason } from "@/app/api/shared/accountAccessDecision/types"

export type AccessPausedCopy = {
  description: string
  guidance: string
}

const GENERIC_DESCRIPTION = "Esta conta está com o acesso pausado."

const DESCRIPTION_BY_REASON: Partial<Record<AccountAccessRestrictionReason, string>> = {
  past_due: "Esta conta está com um pagamento pendente.",
  suspended: "A assinatura desta conta está suspensa.",
  canceled: "A assinatura desta conta foi cancelada.",
  subscription_unavailable: "Não conseguimos confirmar a assinatura desta conta.",
}

const BILLING_OWNER_GUIDANCE_BY_REASON: Partial<Record<AccountAccessRestrictionReason, string>> = {
  past_due: "Regularize o pagamento para liberar o acesso desta conta.",
  suspended: "Reative a assinatura para liberar o acesso desta conta.",
  canceled: "Reative a assinatura para voltar a usar a conta.",
  subscription_unavailable: "Recarregue a página. Se continuar assim, fale com o time de assinaturas.",
}

const DEFAULT_BILLING_OWNER_GUIDANCE =
  "Fale com o time de assinaturas para regularizar o acesso desta conta."
// Sem motivo conhecido o master não tem pagamento a fazer: segue o contato com o suporte.
const MEMBER_GUIDANCE =
  "Avise o administrador desta conta para que ele entre em contato com o time de assinaturas."
const UNAVAILABLE_MEMBER_GUIDANCE =
  "Recarregue a página. Se continuar assim, avise o administrador desta conta."
const BANNED_GUIDANCE = "Fale com o time de assinaturas para entender como seguir."

function getGuidance(reason: AccountAccessRestrictionReason | undefined, isBillingOwner: boolean): string {
  if (reason === "banned") return BANNED_GUIDANCE
  if (reason === "subscription_unavailable" && !isBillingOwner) return UNAVAILABLE_MEMBER_GUIDANCE
  if (!isBillingOwner) return MEMBER_GUIDANCE
  return (reason && BILLING_OWNER_GUIDANCE_BY_REASON[reason]) ?? DEFAULT_BILLING_OWNER_GUIDANCE
}

export function getAccessPausedCopy(
  reason: AccountAccessRestrictionReason | undefined,
  isBillingOwner: boolean
): AccessPausedCopy {
  return {
    description: (reason && DESCRIPTION_BY_REASON[reason]) ?? GENERIC_DESCRIPTION,
    guidance: getGuidance(reason, isBillingOwner),
  }
}
