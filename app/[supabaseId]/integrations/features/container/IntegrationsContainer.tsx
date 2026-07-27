"use client";

import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, FormInput, Webhook } from "lucide-react";
import { LeadFormIntegration } from "../components/LeadFormIntegration";
import { IntegrationsPageSkeleton } from "../components/IntegrationsPageSkeleton";
import { useTeamContext } from "@/app/context/TeamContext";
import { isTeamAllowedForIntegrations } from "@/lib/integrationsAccess";
import { useIntegrationsContext } from "../context/IntegrationsContext";
import { useFeatureAccess } from "@/app/context/FeatureAccessContext";
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

  const inboundHref = `/${supabaseId}/integrations/webhooks/inbound`;
  const outboundHref = `/${supabaseId}/integrations/webhooks/outbound`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte o Corretor Studio a ferramentas e sites externos
        </p>
      </div>

      <LeadFormIntegration />

      <div className="grid gap-4 md:grid-cols-2">
        <Link href={inboundHref} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="h-full transition-colors hover:bg-muted/40">
            <CardHeader className="flex flex-row items-start gap-3">
              <div className="rounded-md border bg-background p-2">
                <ArrowDownToLine className="size-5 text-primary" />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">Webhooks de entrada</CardTitle>
                  <Badge variant="secondary">Receber</Badge>
                </div>
                <CardDescription>
                  Receba eventos de sistemas externos e crie leads automaticamente no CRM.
                </CardDescription>
              </div>
              <Webhook className="size-4 text-muted-foreground" />
            </CardHeader>
          </Card>
        </Link>

        <Link href={outboundHref} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="h-full transition-colors hover:bg-muted/40">
            <CardHeader className="flex flex-row items-start gap-3">
              <div className="rounded-md border bg-background p-2">
                <ArrowUpFromLine className="size-5 text-primary" />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">Webhooks de saída</CardTitle>
                  <Badge variant="outline">Enviar</Badge>
                </div>
                <CardDescription>
                  Envie eventos do CRM para Slack, Teams, Zapier ou qualquer URL HTTPS.
                </CardDescription>
              </div>
              <FormInput className="size-4 text-muted-foreground" />
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
