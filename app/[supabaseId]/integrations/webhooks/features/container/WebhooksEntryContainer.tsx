"use client";

import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeamContext } from "@/app/context/TeamContext";
import { useFeatureAccess } from "@/app/context/FeatureAccessContext";
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";
import { useWebhooksEntryContext } from "../context/WebhooksEntryContext";
import type { WebhookDirectionSummary } from "../context/WebhooksEntryTypes";
import { WebhooksEntryPageSkeleton } from "../components/WebhooksEntryPageSkeleton";

function directionStateLabel(summary: WebhookDirectionSummary, loading: boolean, error: boolean) {
  if (loading) {
    return <Skeleton className="h-4 w-40" />;
  }
  if (error) {
    return "Não foi possível carregar";
  }
  if (summary.total === 0) {
    return "Nenhum webhook configurado";
  }
  const parts = [`${summary.total} configurado${summary.total === 1 ? "" : "s"}`];
  if (summary.active > 0) {
    parts.push(`${summary.active} ativo${summary.active === 1 ? "" : "s"}`);
  }
  if (summary.paused > 0) {
    parts.push(`${summary.paused} pausado${summary.paused === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

export function WebhooksEntryContainer() {
  const { isLoading: isTeamLoading } = useTeamContext();
  const { hasAccess } = useFeatureAccess();
  const { supabaseId, inboundSummary, outboundSummary, loading, error } = useWebhooksEntryContext();

  // Decisão do owner (22/09, achado R15-3): Webhooks fica liberado por
  // `integration` OU `radar` — é o comportamento de hoje (o OR frouxo do
  // extinto `lib/integrationsAccess.ts`), preservado para não tirar acesso
  // de nenhuma conta que já vê Webhooks só com `radar`.
  const hasWebhooksAccess = hasAccess(FEATURE_SLUGS.CONFIGURATION) || hasAccess(FEATURE_SLUGS.RADAR);

  if (isTeamLoading) {
    return <WebhooksEntryPageSkeleton />;
  }

  if (!hasWebhooksAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Webhooks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta área está disponível apenas para times com a integração contratada.
          </p>
        </div>
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Fale com seu gerente de conta para contratar esta integração.
        </div>
      </div>
    );
  }

  const inboundHref = `/${supabaseId}/integrations/webhooks/inbound`;
  const outboundHref = `/${supabaseId}/integrations/webhooks/outbound`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Webhooks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Receba eventos de sistemas externos e envie eventos do CRM para fora
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href={inboundHref}
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
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
                <div className="text-sm text-muted-foreground">{directionStateLabel(inboundSummary, loading, error)}</div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link
          href={outboundHref}
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
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
                <div className="text-sm text-muted-foreground">{directionStateLabel(outboundSummary, loading, error)}</div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* [!] Resumo só leitura do widget legado "Webhook Genérico de Leads" (DA2) aguardando
          a unificação da SPEC 10 A-E1. Ver SPEC 15 B-E2 na tabela de completude. */}
    </div>
  );
}
