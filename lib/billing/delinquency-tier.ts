// 20 — Assinaturas — Backend E9 (Fase 4 do plano de Assinaturas, E1 do
// plano: "Inadimplência em degraus"). Predicado puro que resolve o degrau de
// acesso de uma conta a partir de `subscriptionStatus` +
// `subscriptionNextDueDate` da `ProfileSubscription`. Hoje `past_due` está
// dentro de `ACTIVE_SUBSCRIPTION_STATUSES` (lib/billing/active-subscription-statuses.ts)
// e dá acesso total para sempre (Diagnóstico §7.5) — este módulo não altera
// esse gate binário (conta continua "ativa" para o teamAccess), mas alimenta
// um segundo degrau, mais fino, consumido por FeatureAccessService: a partir
// do dia 5 de atraso a conta perde acesso a tudo que não seja CRM; a partir
// do dia 15, perde tudo (o corte de fato ainda depende do PaymentValidationService
// solicitar INACTIVE no Asaas via PAST_DUE_INACTIVE_AFTER_DAYS — este módulo
// só resolve o degrau local, não a chamada ao Asaas).
export const DELINQUENCY_CRM_ONLY_AFTER_DAYS = 5;
export const DELINQUENCY_CUT_OFF_AFTER_DAYS = 15;

export type DelinquencyTier = "full_access" | "crm_only" | "cut_off";

export type DelinquencyTierInput = {
  subscriptionStatus: string | null | undefined;
  subscriptionNextDueDate: Date | null | undefined;
  hasPermanentSubscription?: boolean;
  now?: Date;
};

function daysSince(reference: Date, now: Date): number {
  const diffMs = now.getTime() - reference.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

export function resolveDelinquencyTier(input: DelinquencyTierInput): DelinquencyTier {
  if (input.hasPermanentSubscription === true) {
    return "full_access";
  }

  if (input.subscriptionStatus !== "past_due") {
    return "full_access";
  }

  // DA3 (E20/E4): ausência de dado nunca é evidência de punição — sem due
  // date não há como medir dias de atraso, então fica em acesso total até
  // existir evidência positiva.
  if (!input.subscriptionNextDueDate) {
    return "full_access";
  }

  const now = input.now ?? new Date();
  const daysLate = daysSince(input.subscriptionNextDueDate, now);

  if (daysLate >= DELINQUENCY_CUT_OFF_AFTER_DAYS) {
    return "cut_off";
  }

  if (daysLate >= DELINQUENCY_CRM_ONLY_AFTER_DAYS) {
    return "crm_only";
  }

  return "full_access";
}
