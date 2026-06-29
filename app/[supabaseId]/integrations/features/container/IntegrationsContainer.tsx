"use client";

import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { LeadFormIntegration } from "../components/LeadFormIntegration";
import { StudioWebhookIntegration } from "../components/StudioWebhookIntegration";
import { IntegrationsPageSkeleton } from "../components/IntegrationsPageSkeleton";
import { useTeamContext } from "@/app/context/TeamContext";
import { isTeamAllowedForIntegrations } from "@/lib/integrationsAccess";
import { useIntegrationsContext } from "../context/IntegrationsContext";
import { useFeatureAccess } from "@/app/context/FeatureAccessContext";
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";

export function IntegrationsContainer() {
  const { activeTeam, isLoading: isTeamLoading } = useTeamContext();
  const { integrationsBootstrapLoading, supabaseId } = useIntegrationsContext();
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
      {hasAccess(FEATURE_SLUGS.WHATSAPP) && (
        <div className="rounded-lg border p-6">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <MessageCircle className="size-5 text-primary" />
            </div>
            <div className="flex flex-1 items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">WhatsApp Business</h3>
                <p className="text-sm text-muted-foreground">
                  As configurações do WhatsApp foram movidas para a página dedicada do módulo.
                </p>
              </div>
              <Link
                href={`/${supabaseId}/whatsapp/configuracoes`}
                className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Configurar
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
