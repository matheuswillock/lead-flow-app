"use client";

import { Code2, Radio, Webhook } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { IntegrationEntryCard } from "../components/IntegrationEntryCard";
import { LeadFormIntegration } from "../components/LeadFormIntegration";
import { IntegrationsPageSkeleton } from "../components/IntegrationsPageSkeleton";
import { useTeamContext } from "@/app/context/TeamContext";
import { useIntegrationsContext } from "../context/IntegrationsContext";
import { useIntegrationsHubWebhooksSummary } from "../context/IntegrationsHubSummaryHook";
import { resolveIntegrationsHubAccess } from "../context/resolveIntegrationsHubAccess";
import { useFeatureAccess } from "@/app/context/FeatureAccessContext";
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";

export function IntegrationsContainer() {
  const { isLoading: isTeamLoading } = useTeamContext();
  const { integrationsBootstrapLoading, supabaseId, radarPixelConfig, radarPixelLoading } = useIntegrationsContext();
  const { hasAccess } = useFeatureAccess();

  const hasIntegrationAccess = hasAccess(FEATURE_SLUGS.CONFIGURATION);
  const hasRadarAccess = hasAccess(FEATURE_SLUGS.RADAR);
  const { apiCatalogLocked, webhooksLocked, pixelLocked } = resolveIntegrationsHubAccess({
    hasIntegrationAccess,
    hasRadarAccess,
  });

  const webhooksSummary = useIntegrationsHubWebhooksSummary(supabaseId, hasIntegrationAccess);

  if (isTeamLoading || integrationsBootstrapLoading) {
    return <IntegrationsPageSkeleton />;
  }

  const subscriptionHref = `/${supabaseId}/subscription`;
  const webhooksHref = `/${supabaseId}/integrations/webhooks`;
  const pixelHref = `/${supabaseId}/integrations/pixel`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte o Corretor Studio a ferramentas e sites externos
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <IntegrationEntryCard
          icon={Code2}
          title="Catálogo de API"
          description="Consulte recursos da API do Studio, cada um com escopo e token próprios."
          badge={{ label: "Em breve", variant: "outline" }}
          state="Disponível em breve"
          locked={apiCatalogLocked}
          lockedHref={subscriptionHref}
        />

        <IntegrationEntryCard
          icon={Webhook}
          title="Webhooks"
          description="Receba eventos de sistemas externos e envie eventos do CRM para fora."
          badge={{ label: "Entrada e saída", variant: "secondary" }}
          state={
            webhooksLocked ? (
              "Fale com seu gerente de conta"
            ) : webhooksSummary.loading ? (
              <Skeleton className="h-4 w-32" />
            ) : webhooksSummary.totalCount === 0 ? (
              "Nenhum webhook configurado"
            ) : (
              `${webhooksSummary.totalCount} webhook${webhooksSummary.totalCount === 1 ? "" : "s"} · ${webhooksSummary.activeCount} ativo${webhooksSummary.activeCount === 1 ? "" : "s"}`
            )
          }
          locked={webhooksLocked}
          lockedHref={subscriptionHref}
          href={webhooksLocked ? undefined : webhooksHref}
        />

        <IntegrationEntryCard
          icon={Radio}
          title="Pixel"
          description="Rastreie visitantes anônimos do seu site e enriqueça perfis no Radar."
          badge={{ label: "Radar", variant: "secondary" }}
          state={
            pixelLocked ? (
              "Fale com seu gerente de conta"
            ) : radarPixelLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : radarPixelConfig?.configured ? (
              "Pixel configurado"
            ) : (
              "Pixel não configurado"
            )
          }
          locked={pixelLocked}
          lockedHref={subscriptionHref}
          href={pixelLocked ? undefined : pixelHref}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Outras integrações</h2>
        <LeadFormIntegration />
      </div>
    </div>
  );
}
