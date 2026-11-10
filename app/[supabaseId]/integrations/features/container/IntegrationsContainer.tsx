"use client";

import { Code2, FileText, Radio, Webhook } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { IntegrationEntryCard } from "../components/IntegrationEntryCard";
import { IntegrationFlowChecklist, buildIntegrationFlowSteps } from "../components/IntegrationFlowChecklist";
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

  const hasApiCatalogAccess = hasAccess(FEATURE_SLUGS.API_CATALOG);
  const hasWebhooksAccess = hasAccess(FEATURE_SLUGS.WEBHOOKS);
  const hasRadarAccess = hasAccess(FEATURE_SLUGS.RADAR);
  const hasPixelAccess = hasAccess(FEATURE_SLUGS.PIXEL);
  const hasLeadFormAccess = hasAccess(FEATURE_SLUGS.LEAD_FORM);
  const { apiCatalogLocked, webhooksLocked, pixelLocked } = resolveIntegrationsHubAccess({
    hasApiCatalogAccess,
    hasWebhooksAccess,
    hasRadarAccess,
    hasPixelAccess,
  });

  const webhooksSummary = useIntegrationsHubWebhooksSummary(supabaseId, !webhooksLocked);
  const leadFormLocked = !hasLeadFormAccess;

  if (isTeamLoading || integrationsBootstrapLoading) {
    return <IntegrationsPageSkeleton />;
  }

  const subscriptionHref = `/${supabaseId}/subscription`;
  const webhooksHref = `/${supabaseId}/integrations/webhooks`;
  const pixelHref = `/${supabaseId}/integrations/pixel`;
  const apiCatalogHref = `/${supabaseId}/integrations/api-catalog`;
  const leadFormHref = `/${supabaseId}/integrations/lead-form`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte o Corretor Studio a ferramentas e sites externos
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <IntegrationEntryCard
          icon={Code2}
          title="Catálogo de API"
          description="Consulte recursos da API do Studio, cada um com escopo e token próprios."
          badge={{ label: "Horários disponíveis", variant: "secondary" }}
          state="Gerar token e ver como usar"
          locked={apiCatalogLocked}
          lockedHref={subscriptionHref}
          href={apiCatalogLocked ? undefined : apiCatalogHref}
        />

        <IntegrationEntryCard
          icon={Webhook}
          title="Webhooks"
          description="Receba eventos de sistemas externos e envie eventos do CRM para fora."
          badge={{ label: "Entrada e saída", variant: "secondary" }}
          state={
            webhooksLocked ? (
              "Ver planos disponíveis"
            ) : webhooksSummary.loading ? (
              <Skeleton className="h-4 w-32" />
            ) : webhooksSummary.error ? (
              "Não foi possível carregar"
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
              "Ver planos disponíveis"
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

        <IntegrationEntryCard
          icon={FileText}
          title="Formulário de Captação de Leads"
          description="Compartilhe este link para receber leads diretamente no seu board."
          state={leadFormLocked ? "Ver planos disponíveis" : "Gerar link e compartilhar"}
          locked={leadFormLocked}
          lockedHref={subscriptionHref}
          href={leadFormLocked ? undefined : leadFormHref}
        />
      </div>

      <IntegrationFlowChecklist steps={buildIntegrationFlowSteps({ supabaseId, webhooksLocked, apiCatalogLocked })} />
    </div>
  );
}
