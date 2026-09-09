import type { SubscriptionLifecycleEvent } from "@prisma/client";

// 20 — Assinaturas — Backend E1 (C12). Substitui o mapeamento fixo
// status→evento do PR #902 (`active` sempre virava "restored", inclusive na
// primeira contratação — o próprio PaymentValidationService.updateProfileStatus
// gravava isso indiscriminadamente em todo PAYMENT_CONFIRMED). A distinção
// exige o status ANTERIOR, não só o novo:
//   - sem status anterior (ou "trial") → primeira contratação: contracted
//   - já estava "active" → renovação recorrente: renewed
//   - vinha de past_due/suspended/canceled → reativação: restored
export function lifecycleEventFromSubscriptionStatus(
  previousStatus: string | null | undefined,
  nextStatus: string,
): SubscriptionLifecycleEvent | null {
  if (nextStatus === "active") {
    if (!previousStatus || previousStatus === "trial") return "contracted";
    if (previousStatus === "active") return "renewed";
    return "restored";
  }
  if (nextStatus === "past_due") return "overdue";
  if (nextStatus === "suspended") return "reduced";
  if (nextStatus === "canceled") return "cut";
  return null;
}
