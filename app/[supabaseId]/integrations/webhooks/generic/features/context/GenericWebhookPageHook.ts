"use client";

import { useTeamContext } from "@/app/context/TeamContext";
import { useFeatureAccess } from "@/app/context/FeatureAccessContext";
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";
import { useIntegrationsContext } from "@/app/[supabaseId]/integrations/features/context/IntegrationsContext";
import type { GenericWebhookPageState } from "./GenericWebhookPageTypes";

/**
 * Deriva o estado de acesso/loading da página do Webhook Genérico a partir
 * do `IntegrationsContext` compartilhado (mesma fonte do `StudioWebhookIntegration`),
 * igual ao padrão de `usePixelPage`.
 */
export function useGenericWebhookPage(): GenericWebhookPageState {
  const { isLoading: isTeamLoading } = useTeamContext();
  const { hasAccess } = useFeatureAccess();
  const { integrationsBootstrapLoading } = useIntegrationsContext();

  // Mesma regra de acesso da área de Webhooks (webhooks OU radar, R15-3).
  const hasWebhooksAccess = hasAccess(FEATURE_SLUGS.WEBHOOKS) || hasAccess(FEATURE_SLUGS.RADAR);
  const isLoading = isTeamLoading || (hasWebhooksAccess && integrationsBootstrapLoading);

  return { hasWebhooksAccess, isLoading };
}
