const PAID_ASAAS_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "APPROVED"]);

/** Mesmo vocabulário de status pago usado em `BackofficeAdhesionService.ts` e afins. */
export function isPaidPaymentStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return PAID_ASAAS_STATUSES.has(status);
}

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

export type CheckoutReturnStatus = "checking" | "confirmed" | "processing";

/**
 * Estado inicial nunca é "confirmado" (DA1/P1-3): sem referência, cai direto
 * no honesto "processando"; com referência, começa "verificando" até o
 * primeiro poll resolver.
 */
export function resolveInitialCheckoutReturnStatus(paymentReference: string | null): CheckoutReturnStatus {
  return paymentReference ? "checking" : "processing";
}
