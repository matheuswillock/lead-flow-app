/**
 * SPEC 40 — claim atômico de lead-sync por submissão.
 *
 * Bug de produção (nota `2026-08-28-liber-leads-duplicados-origem-campanha-email.md`,
 * adenda 02/09): o renderer dispara DOIS POSTs de `/progress` da mesma sessão
 * com ~70ms de distância (blur + `page_advanced`). Os dois processamentos
 * chamam `findMatchingLead` (SELECT) antes de qualquer um commitar o create —
 * TOCTOU clássico, e os dois criam lead.
 *
 * Não há unique de identidade em `Lead` que resolva isso, e não pode haver: a
 * regra status-aware (PR #1114) permite por design múltiplos leads vivos com
 * a mesma identidade em status diferentes. O claim atômico é feito na
 * submissão, não no lead: `/progress` e o accept compartilham a MESMA linha
 * de `corretor_studio_public_form_submissions` (coluna `leadSyncClaimedAt`).
 *
 * Quem perde o claim (`claimSubmissionForLeadSync` devolve `false`) espera o
 * vencedor commitar e re-resolve por até `LEAD_SYNC_CLAIM_RETRY_ATTEMPTS`
 * tentativas. Se o vencedor nunca aparece — processo morto, erro não
 * relacionado — cria mesmo assim: duplicata rara é preferível a lead perdido.
 */

export const LEAD_SYNC_CLAIM_RETRY_ATTEMPTS = 3
export const LEAD_SYNC_CLAIM_RETRY_DELAY_MS = 700

/** Extraído para ser substituível em teste — produção nunca precisa esperar de verdade. */
export function waitForLeadSyncClaimRetry(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
