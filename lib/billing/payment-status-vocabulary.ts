/**
 * Vocabulário compartilhado de status de pagamento do Asaas para as telas
 * públicas de confirmação (SPEC 41 E2).
 *
 * Existe porque "parou de mentir" depende de três categorias distintas, e
 * tratar as duas últimas como uma só foi exatamente o achado das revisões do
 * PR #1197:
 *
 * - **pago** — sucesso definitivo.
 * - **falha terminal** — acabou e não vai virar pago sozinho (recusado,
 *   estornado, chargeback, cancelado, vencido). Continuar em "estamos
 *   confirmando… avisaremos por e-mail" nesses casos é mentira.
 * - **em trânsito** — ainda pode virar pago (`PENDING`, `BANK_PROCESSING`) ou
 *   é marcador interno de provisionamento em andamento
 *   (`SUBSCRIPTION_UPDATED`, gravado por
 *   `CheckoutAsaasUseCase.processOperatorCheckoutPaid` **antes** de o operador
 *   existir). Parar o polling aqui congela a tela no meio do provisionamento.
 *
 * Fonte dos literais: `app/api/services/PaymentValidation/AsaasWebhookTypes.ts`
 * (`PaymentStatus`) e `PendingOperatorRepository.markSubscriptionUpdated`.
 */

/** Status que significam dinheiro recebido. */
const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "APPROVED"]);

/**
 * Status que encerram a cobrança sem pagamento. `OVERDUE` entra aqui de
 * propósito: um boleto/PIX vencido não vira pago sem uma nova cobrança, então
 * seguir "aguardando" nele é o mesmo beco sem saída que a SPEC 41 fecha.
 */
const TERMINAL_FAILURE_STATUSES = new Set([
  "REFUSED",
  "REFUNDED",
  "REFUND_REQUESTED",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "AWAITING_CHARGEBACK_REVERSAL",
  "CANCELLED",
  "CANCELED",
  "OVERDUE",
  "FAILED",
]);

/**
 * Marcador interno gravado entre "pagamento confirmado" e "operador criado".
 * Não é status do Asaas e **MUST NOT** ser tratado como terminal.
 */
export const SUBSCRIPTION_UPDATED_MARKER = "SUBSCRIPTION_UPDATED";

export type PaymentOutcome = "paid" | "failed" | "in-flight";

export function isPaidPaymentStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return PAID_STATUSES.has(status);
}

export function isTerminalFailurePaymentStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return TERMINAL_FAILURE_STATUSES.has(status);
}

/** Classifica um status em uma das três categorias acima. */
export function classifyPaymentStatus(status: string | null | undefined): PaymentOutcome {
  if (isPaidPaymentStatus(status)) return "paid";
  if (isTerminalFailurePaymentStatus(status)) return "failed";
  return "in-flight";
}

/** Polling só para em desfecho definitivo — nunca no meio do caminho (DA3). */
export function isTerminalPaymentStatus(status: string | null | undefined): boolean {
  return classifyPaymentStatus(status) !== "in-flight";
}
