"use client";

import { useTeamContext } from "@/app/context/TeamContext";
import { useFeatureAccess } from "@/app/context/FeatureAccessContext";
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";
import { useIntegrationsContext } from "@/app/[supabaseId]/integrations/features/context/IntegrationsContext";
import type { LeadFormPageActions, LeadFormPageState } from "./LeadFormPageTypes";

/**
 * Deriva o estado da página do Formulário de Captação a partir do
 * `IntegrationsContext` compartilhado (mesma fonte do card no hub de
 * Integrações), igual ao padrão de `usePixelPage`.
 */
export function useLeadFormPage(): LeadFormPageState & LeadFormPageActions {
  const { isLoading: isTeamLoading } = useTeamContext();
  const { hasAccess } = useFeatureAccess();
  const { integrationsBootstrapLoading, leadFormUrl, leadFormFullUrl, copyLeadFormUrl } = useIntegrationsContext();

  const hasLeadFormAccess = hasAccess(FEATURE_SLUGS.LEAD_FORM);
  const isLoading = isTeamLoading || (hasLeadFormAccess && integrationsBootstrapLoading);

  return {
    hasLeadFormAccess,
    isLoading,
    leadFormUrl,
    leadFormFullUrl,
    copyLeadFormUrl,
  };
}
