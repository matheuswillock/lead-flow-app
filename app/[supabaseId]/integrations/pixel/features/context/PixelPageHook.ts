"use client";

import { useTeamContext } from "@/app/context/TeamContext";
import { useFeatureAccess } from "@/app/context/FeatureAccessContext";
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";
import { useIntegrationsContext } from "@/app/[supabaseId]/integrations/features/context/IntegrationsContext";
import type { PixelPageState } from "./PixelPageTypes";

/**
 * Deriva o estado de acesso/loading da página do Pixel a partir do
 * `IntegrationsContext` compartilhado (mesma fonte do `RadarPixelIntegration`,
 * SPEC 30). Mantém `PixelPageContainer` livre de conhecer os três contextos
 * de origem (time, feature access, integrações).
 */
export function usePixelPage(): PixelPageState {
  const { isLoading: isTeamLoading } = useTeamContext();
  const { hasAccess } = useFeatureAccess();
  const { integrationsBootstrapLoading, radarPixelConfig, radarPixelLoading } = useIntegrationsContext();

  const hasRadarAccess = hasAccess(FEATURE_SLUGS.RADAR);
  const isLoading = isTeamLoading || (hasRadarAccess && integrationsBootstrapLoading);

  return {
    hasRadarAccess,
    isLoading,
    radarPixelConfigured: radarPixelConfig?.configured ?? false,
    radarPixelLoading,
  };
}
