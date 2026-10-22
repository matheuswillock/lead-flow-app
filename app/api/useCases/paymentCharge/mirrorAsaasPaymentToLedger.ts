import type { AsaasAccountId } from "@/lib/asaas"
import type { AsaasShadowMirror, AsaasShadowPayment } from "@/app/api/services/paymentCharge/AsaasShadowMirror"

type ShadowBody = { readonly event?: string; readonly payment?: AsaasShadowPayment }

/** O espelho é observabilidade: o webhook nunca espera por ele além deste limite. */
export const LEDGER_MIRROR_TIMEOUT_MS = 1500

type MirrorOptions = {
  readonly timeoutMs?: number
  readonly logWarn?: (message: string, context: Record<string, unknown>) => void
}

const loadMirror = async (): Promise<AsaasShadowMirror> => {
  const { createAsaasShadowMirror } = await import("@/app/api/services/paymentCharge/paymentChargeComposition")
  return createAsaasShadowMirror()
}

/**
 * Espelho do Asaas no ledger (ASAAS_SHADOW). Isolado do webhook: qualquer falha, inclusive na
 * composição, vira log e o efeito de domínio segue exatamente como antes. Também é limitado no
 * tempo: ao estourar, o webhook segue e o espelho (que é idempotente) é reconciliado pelo cron.
 */
export async function mirrorAsaasPaymentToLedger(
  body: ShadowBody,
  account: AsaasAccountId,
  createMirror: () => Promise<AsaasShadowMirror> = loadMirror,
  options: MirrorOptions = {},
): Promise<void> {
  if (!body.payment) return
  const payment = body.payment
  const timeoutMs = options.timeoutMs ?? LEDGER_MIRROR_TIMEOUT_MS
  const logWarn = options.logWarn ?? ((message, context) => console.warn(message, context))

  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs)
  })
  const mirrored = (async () => {
    try {
      const mirror = await createMirror()
      await mirror.mirrorPayment({ account, event: body.event ?? "", payment })
    } catch (error) {
      console.error("[AsaasWebhookRoute][ledger-shadow] Error", {
        paymentId: payment.id ?? null,
        message: error instanceof Error ? error.message : "unknown",
      })
    }
    return "done" as const
  })()

  const outcome = await Promise.race([mirrored, timedOut])
  clearTimeout(timer)
  if (outcome === "timeout") {
    logWarn("[AsaasWebhookRoute][ledger-mirror-timeout]", { paymentId: payment.id ?? null, timeoutMs })
  }
}
