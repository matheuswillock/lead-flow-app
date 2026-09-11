import { isActiveSubscriptionStatus } from "./active-subscription-statuses";

// 20 — Assinaturas — Backend E8 (C2). Predicado puro que marca perfis com
// hasPermanentSubscription=true E assinatura ativa (active/trial/past_due,
// ver lib/billing/active-subscription-statuses.ts) para exclusão da
// recriação automática no ledger da migração ([[30 — Migração de Conta
// (execução) — Backend]] M5.3/M5.4 — não implementado nesta base ainda;
// este estágio entrega só o predicado + teste, a integração com o ledger é
// de lá). Casos reais que ele existe para pegar: Bruno (interno), Matheus
// (owner, past_due) e Corretor Seguro (past_due) — dois dos três estavam
// past_due, não "active" puro, por isso o predicado usa
// isActiveSubscriptionStatus (inclui past_due), não uma comparação estrita
// com "active".
export type MigrationGateProfileInput = {
  hasPermanentSubscription: boolean;
  subscriptionStatus: string | null | undefined;
};

export function isBlockedFromAutomaticMigration(input: MigrationGateProfileInput): boolean {
  return input.hasPermanentSubscription === true && isActiveSubscriptionStatus(input.subscriptionStatus);
}
