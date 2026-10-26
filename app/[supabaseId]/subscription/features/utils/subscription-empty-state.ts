/**
 * DA2 (SPEC 21): ausência de assinatura ≠ falha de fetch ≠ mudança em andamento.
 *
 * O backend hoje não expõe um flag `pendingChange` no GET de assinatura
 * (contrato nasceria em [[20 — Assinaturas — Backend]], Open question #2 da
 * SPEC 21 — ainda sem resposta). Enquanto isso, a heurística usada aqui é:
 * se este navegador viu uma assinatura ativa recentemente (sessionStorage,
 * por supabaseId) e agora o GET volta `null`, o intervalo é tratado como
 * "mudança em andamento" (janela dual-account/migração) em vez de "nunca
 * teve assinatura" — suprimindo o CTA de criar uma segunda assinatura.
 *
 * Heurística deliberadamente pessimista sobre a janela: 10 minutos é maior
 * que o pior caso observado na auditoria (C15/C27) para a troca ficar
 * visível de novo, e curto o suficiente para não mascarar um cancelamento
 * real por mais que alguns minutos.
 */

export type SubscriptionEmptyStateReason = 'none' | 'pending-change';

export const SUBSCRIPTION_PENDING_CHANGE_WINDOW_MS = 10 * 60 * 1000;

export function resolveSubscriptionEmptyStateReason(input: {
  lastSeenSubscriptionAt: number | null;
  now?: number;
}): SubscriptionEmptyStateReason {
  if (input.lastSeenSubscriptionAt == null) return 'none';

  const elapsed = (input.now ?? Date.now()) - input.lastSeenSubscriptionAt;
  if (elapsed < 0) return 'none';

  return elapsed <= SUBSCRIPTION_PENDING_CHANGE_WINDOW_MS ? 'pending-change' : 'none';
}

export function subscriptionRecentActivityStorageKey(supabaseId: string): string {
  return `subscription:last-seen:${supabaseId}`;
}

export function readLastSeenSubscriptionAt(supabaseId: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(subscriptionRecentActivityStorageKey(supabaseId));
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLastSeenSubscriptionAt(supabaseId: string, at: number = Date.now()): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(subscriptionRecentActivityStorageKey(supabaseId), String(at));
  } catch {
    // sessionStorage indisponível (modo privado/quota) — heurística vira no-op, nunca quebra o fluxo.
  }
}
