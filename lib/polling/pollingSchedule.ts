/**
 * Agenda de polling compartilhada (DA3 da SPEC 41 — Checkout, Adesões e
 * Add-ons — Frontend): um único dono de polling por tela, com backoff e
 * teto de tentativas. Nenhuma tela pode prometer "atualização automática"
 * sem um mecanismo real por trás, e nenhuma tela pode girar para sempre.
 *
 * Tentativa 0 é imediata (o usuário pode já ter o pagamento confirmado ao
 * chegar na tela); as tentativas seguintes usam backoff linear de 5s a 8s.
 */

const POLLING_INITIAL_DELAY_MS = 5000;
const POLLING_MAX_DELAY_MS = 8000;
const POLLING_BACKOFF_STEP_MS = 1000;

/** Teto de tentativas — nunca spinner eterno (DA3). */
export const POLLING_MAX_ATTEMPTS = 6;

/** Atraso (ms) antes da tentativa `attempt` (0-based). */
export function getPollingDelayMs(attempt: number): number {
  if (attempt <= 0) return 0;
  const delay = POLLING_INITIAL_DELAY_MS + (attempt - 1) * POLLING_BACKOFF_STEP_MS;
  return Math.min(delay, POLLING_MAX_DELAY_MS);
}

/** Verdadeiro quando a tentativa informada já esgotou o teto. */
export function hasReachedPollingCap(attempt: number): boolean {
  return attempt >= POLLING_MAX_ATTEMPTS;
}
