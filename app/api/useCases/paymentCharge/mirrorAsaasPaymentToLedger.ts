import type { AsaasAccountId } from "@/lib/asaas"
import type { AsaasShadowMirror, AsaasShadowPayment } from "@/app/api/services/paymentCharge/AsaasShadowMirror"

type ShadowBody = { readonly event?: string; readonly payment?: AsaasShadowPayment }

const loadMirror = async (): Promise<AsaasShadowMirror> => {
  const { createAsaasShadowMirror } = await import("@/app/api/services/paymentCharge/paymentChargeComposition")
  return createAsaasShadowMirror()
}

/**
 * Espelho do Asaas no ledger (ASAAS_SHADOW). Isolado do webhook: qualquer falha, inclusive na
 * composição, vira log e o efeito de domínio segue exatamente como antes.
 */
export async function mirrorAsaasPaymentToLedger(
  body: ShadowBody,
  account: AsaasAccountId,
  createMirror: () => Promise<AsaasShadowMirror> = loadMirror,
): Promise<void> {
  if (!body.payment) return
  try {
    const mirror = await createMirror()
    await mirror.mirrorPayment({ account, event: body.event ?? "", payment: body.payment })
  } catch (error) {
    console.error("[AsaasWebhookRoute][ledger-shadow] Error", {
      paymentId: body.payment.id ?? null,
      message: error instanceof Error ? error.message : "unknown",
    })
  }
}
