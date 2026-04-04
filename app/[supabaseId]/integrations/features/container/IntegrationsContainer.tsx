"use client";

import { LeadFormIntegration } from "../components/LeadFormIntegration";
import { StudioWebhookIntegration } from "../components/StudioWebhookIntegration";
import { useTeamContext } from "@/app/context/TeamContext";
import { isTeamAllowedForIntegrations } from "@/lib/integrationsAccess";

export function IntegrationsContainer() {
  const { activeTeam } = useTeamContext();
  const canAccessIntegrations = isTeamAllowedForIntegrations(activeTeam?.id);

  if (!canAccessIntegrations) {
    return (
      <div className="space-y-6 p-6">
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
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte o Corretor Studio a ferramentas e sites externos
        </p>
      </div>

      <LeadFormIntegration />
      <StudioWebhookIntegration />
    </div>
  );
}
