"use client";

import { LeadFormIntegration } from "../components/LeadFormIntegration";
import { StudioWebhookIntegration } from "../components/StudioWebhookIntegration";
import { WhatsAppIntegration } from "../components/WhatsAppIntegration";
import { IntegrationsPageSkeleton } from "../components/IntegrationsPageSkeleton";
import { useTeamContext } from "@/app/context/TeamContext";
import { isTeamAllowedForIntegrations } from "@/lib/integrationsAccess";
import { useIntegrationsContext } from "../context/IntegrationsContext";
import { useFeatureAccess } from "@/app/context/FeatureAccessContext";
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";

export function IntegrationsContainer() {
  const { activeTeam, isLoading: isTeamLoading } = useTeamContext();
  const { integrationsBootstrapLoading } = useIntegrationsContext();
  const { hasAccess } = useFeatureAccess();
  const canAccessIntegrations =
    isTeamAllowedForIntegrations(activeTeam?.id) || hasAccess(FEATURE_SLUGS.CONFIGURATION);

  if (isTeamLoading || (canAccessIntegrations && integrationsBootstrapLoading)) {
    return <IntegrationsPageSkeleton />;
  }

  if (!canAccessIntegrations) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Integrações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta área está disponível apenas para times autorizados.
          </p>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="text-base font-semibold">Acesso restrito</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Selecione um time autorizado para visualizar as integrações.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte o Corretor Studio a ferramentas e sites externos
        </p>
      </div>

      <LeadFormIntegration />
      <StudioWebhookIntegration />
      <WhatsAppIntegration />
    </div>
  );
}
