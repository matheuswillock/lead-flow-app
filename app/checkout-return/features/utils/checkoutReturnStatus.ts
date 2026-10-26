import { classifyPaymentStatus } from "@/lib/billing/payment-status-vocabulary";

export { isPaidPaymentStatus } from "@/lib/billing/payment-status-vocabulary";

interface SearchParamsLike {
  get(name: string): string | null;
}

/**
 * O `successUrl` do checkout Asaas hoje não carrega nenhuma referência de
 * pagamento (`CheckoutAsaasUseCase.ts:240`, `payments/create-card/route.ts:85`
 * — nenhum dos dois usa macro do gateway). Enquanto isso não muda no backend,
 * a consulta de status é impossível e a tela cai direto no estado honesto de
 * "processando". Os três nomes cobertos aqui são os candidatos mais prováveis
 * assim que uma referência passar a ser anexada, para não exigir mudança
 * neste arquivo quando isso acontecer.
 */
export function readPaymentReference(searchParams: SearchParamsLike): string | null {
  return searchParams.get("payment") ?? searchParams.get("paymentId") ?? searchParams.get("checkoutId");
}

export type CheckoutReturnStatus = "checking" | "confirmed" | "processing" | "failed";

/**
 * Estado inicial nunca é "confirmado" (DA1/P1-3): sem referência, cai direto
 * no honesto "processando"; com referência, começa "verificando" até o
 * primeiro poll resolver.
 */
export function resolveInitialCheckoutReturnStatus(paymentReference: string | null): CheckoutReturnStatus {
  return paymentReference ? "checking" : "processing";
}

/**
 * Traduz o status consultado no Asaas para o estado de tela.
 *
 * `null` significa "siga verificando". Falha terminal (recusado, estornado,
 * chargeback, vencido, cancelado) **MUST** virar `failed` e não ficar rodando
 * até o teto para então dizer "estamos confirmando, avisaremos por e-mail" —
 * isso é mentira para um pagamento que já acabou. Achado P2 do Codex na
 * revisão do PR #1197.
 */
export function resolveCheckoutReturnStatusFromPayment(
  status: string | null | undefined
): CheckoutReturnStatus | null {
  switch (classifyPaymentStatus(status)) {
    case "paid":
      return "confirmed";
    case "failed":
      return "failed";
    default:
      return null;
  }
}
