// 20 — Assinaturas — Backend E9. Predicado puro que resolve o degrau de
// comunicação de uma conta a partir de `subscriptionStatus` +
// `subscriptionNextDueDate` da `ProfileSubscription`, consumido pelo e-mail
// de dunning (OverdueReminderUseCase) para escolher o tom do aviso: "reduced"
// a partir do dia 5, "cut" a partir do dia 15. Não decide acesso real — quem
// decide isso é AccountAccessDecisionService/FeatureAccessService, via a
// janela de carência (BILLING_GRACE_DAYS, billingGraceWindow.ts), que não tem
// corte fixo de dias.
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
 * Vencimento efetivo. A data de vencimento existe em dois lugares (`Profile` e
 * `ProfileSubscription`) e o webhook do Asaas (`processAsaasWebhookEvent.ts`,
 * SUBSCRIPTION_UPDATED) atualiza só o `Profile`. Decisão da Nathiele (11/11/2026): o
 * atraso é **sempre contado a partir da data mais antiga** das duas. Se só uma
 * existe, vale ela; sem nenhuma, não há como medir atraso (null, sem punição).
 * Todo cálculo de carência, somente leitura e pausa deve usar esta função.
 */
export function resolveEffectiveNextDueDate(
  subscriptionDate: Date | null | undefined,
  profileDate: Date | null | undefined,
): Date | null {
  if (!subscriptionDate) return profileDate ?? null;
  if (!profileDate) return subscriptionDate;
  return profileDate.getTime() < subscriptionDate.getTime() ? profileDate : subscriptionDate;
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

/**
 * Avisos da carência (vencimento até o dia anterior ao modo somente leitura). Não são degraus de
 * acesso: o acesso continua completo, o aviso só lembra o master de renovar antes de perdê-lo.
 */
export type GraceNotice = "grace_started" | "grace_last_day";

export type GraceNoticeInput = {
  subscriptionStatus: string | null | undefined;
  subscriptionNextDueDate: Date | null | undefined;
  hasPermanentSubscription?: boolean;
  now?: Date;
};

/**
 * Qual aviso vale hoje para quem está na carência: o do início (dias 0 a 3 de atraso) ou o do
 * último dia (dia 4, antes de virar somente leitura no dia 5). Fora da carência, nenhum.
 */
export function resolveGraceNotice(input: GraceNoticeInput): GraceNotice | null {
  if (input.hasPermanentSubscription === true) return null;
  if (input.subscriptionStatus !== "past_due" || !input.subscriptionNextDueDate) return null;

  const daysLate = daysSince(input.subscriptionNextDueDate, input.now ?? new Date());
  if (daysLate < 0 || daysLate >= DELINQUENCY_CRM_ONLY_AFTER_DAYS) return null;
  return daysLate === DELINQUENCY_CRM_ONLY_AFTER_DAYS - 1 ? "grace_last_day" : "grace_started";
}
