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
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";
import { FEATURE_PRODUCT_SLUG_MAP } from "@/lib/features/feature-product-slug-map";

export const DELINQUENCY_CRM_ONLY_AFTER_DAYS = 5;
export const DELINQUENCY_CUT_OFF_AFTER_DAYS = 15;

/**
 * Slugs que sobrevivem ao degrau `crm_only`. Derivado de `FEATURE_SLUGS` —
 * toda chave `CRM`/`CRM_*` — e NÃO só de `FEATURE_PRODUCT_SLUG_MAP`: o mapa
 * existe para resolver **produto de cobrança** e está incompleto para este
 * fim (`crm-automations` não está lá). Filtrar só pelo mapa tirava Automações
 * de quem o e-mail de dunning acabou de avisar que continua com o CRM
 * (achado cursor no PR #1198). Derivar das chaves mantém a lista correta
 * sozinha quando um `CRM_*` novo nascer, sem mexer no mapa de cobrança —
 * alterar o mapa mudaria `resolveBillingProductSlug` e poderia liberar
 * feature PAID/ADDON hoje negada, efeito colateral fora do escopo da Fase 4.
 */
export const CRM_ONLY_ALLOWED_FEATURE_SLUGS: ReadonlySet<string> = new Set(
  Object.entries(FEATURE_SLUGS)
    .filter(([key]) => key === "CRM" || key.startsWith("CRM_"))
    .map(([, slug]) => slug),
);

/** Slug continua acessível no degrau `crm_only`? */
export function isAllowedUnderCrmOnly(slug: string): boolean {
  return CRM_ONLY_ALLOWED_FEATURE_SLUGS.has(slug) || FEATURE_PRODUCT_SLUG_MAP[slug] === "crm";
}

/**
 * Vencimento efetivo. `ProfileSubscription` é a verdade viva, mas o webhook
 * do Asaas (`processAsaasWebhookEvent.ts`, SUBSCRIPTION_UPDATED) atualiza
 * **só** `Profile.subscriptionNextDueDate` — conta que ainda não passou pelo
 * `AsaasSubscriptionSyncService` tem data fresca no Profile e nula/velha na
 * ProfileSubscription (achado codex P1 no PR #1198). Usa a **mais recente**
 * das duas: data mais nova = menos punição, então a dessincronia nunca corta
 * ninguém antes da hora.
 */
export function resolveEffectiveNextDueDate(
  subscriptionDate: Date | null | undefined,
  profileDate: Date | null | undefined,
): Date | null {
  if (!subscriptionDate) return profileDate ?? null;
  if (!profileDate) return subscriptionDate;
  return profileDate.getTime() > subscriptionDate.getTime() ? profileDate : subscriptionDate;
}

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
