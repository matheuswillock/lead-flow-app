import { isTerminalFailurePaymentStatus } from "@/lib/billing/payment-status-vocabulary";

export interface OperatorProvisioningInput {
  paymentStatus: string;
  operatorCreated: boolean;
}

export type OperatorProvisioningOutcome =
  /** Operador existe — sucesso definitivo. */
  | "created"
  /** Cobrança acabou sem pagamento — não vira operador sozinho. */
  | "failed"
  /** Pagamento aceito, operador ainda sendo provisionado. */
  | "provisioning"
  /** Pagamento ainda não aconteceu. */
  | "awaiting-payment";

/**
 * A tela de operador tem um desfecho a mais que uma cobrança comum: pagar não
 * é o fim, criar o operador é. Entre os dois existe uma janela real de
 * provisionamento — `processOperatorCheckoutPaid` grava o marcador
 * `SUBSCRIPTION_UPDATED` e só depois `createOperatorFromPending` liga
 * `operatorCreated`. Tratar "status != PENDING" como fim (o que esta tela
 * fazia) parava o polling no meio dessa janela e caía no fallback
 * "Pagamento Não Confirmado" — a tela mentia falha justamente no caminho
 * feliz. Achado do cursor na revisão do PR #1197.
 */
export function classifyOperatorProvisioning({
  paymentStatus,
  operatorCreated,
}: OperatorProvisioningInput): OperatorProvisioningOutcome {
  if (operatorCreated) return "created";
  if (isTerminalFailurePaymentStatus(paymentStatus)) return "failed";
  if (paymentStatus === "PENDING") return "awaiting-payment";
  return "provisioning";
}

/** Polling só para quando o operador existe ou a cobrança falhou de vez (DA3). */
export function isOperatorProvisioningTerminal(input: OperatorProvisioningInput): boolean {
  const outcome = classifyOperatorProvisioning(input);
  return outcome === "created" || outcome === "failed";
}

/** Motivo pelo qual uma tentativa de poll não trouxe dados. */
export type PollFailureReason =
  /** Não há o que buscar — sem id na URL. Nenhum retry resolve. */
  | "missing-id"
  /** Uma chamada já estava em voo; esta tentativa simplesmente não fez nada. */
  | "in-flight"
  /** Rede caiu, 5xx, timeout — o próximo retry pode muito bem funcionar. */
  | "transient";

/**
 * Achado P2 da revisão do PR #1207 (chatgpt-codex-connector, thread
 * PRRT_...ZZPv): a tela tratava QUALQUER `{ ok: false }` como desfecho
 * terminal, então uma falha de rede ou um 5xx passageiro na primeira
 * tentativa parava todo o polling automático e jogava o usuário no estado
 * de erro manual — justamente na tela em que ele acabou de pagar e está
 * esperando o provisionamento. O teto de tentativas (`usePollingWithCap`)
 * já limita a insistência; não há razão para desistir na primeira falha
 * transitória.
 *
 * Continua terminal só o que nenhum retry resolve: id ausente.
 */
export function isPollFailureTerminal(reason: PollFailureReason): boolean {
  return reason === "missing-id";
}
