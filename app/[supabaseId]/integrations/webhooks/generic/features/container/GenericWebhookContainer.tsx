"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIntegrationsContext } from "@/app/[supabaseId]/integrations/features/context/IntegrationsContext";
import { StudioWebhookIntegration } from "@/app/[supabaseId]/integrations/features/components/StudioWebhookIntegration";
import { useGenericWebhookPage } from "../context/GenericWebhookPageHook";
import { GenericWebhookPageSkeleton } from "../components/GenericWebhookPageSkeleton";

export function GenericWebhookContainer() {
  const { supabaseId } = useIntegrationsContext();
  const { hasWebhooksAccess, isLoading } = useGenericWebhookPage();

  if (isLoading) {
    return <GenericWebhookPageSkeleton />;
  }

  if (!hasWebhooksAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Webhook Genérico de Leads</h1>
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild className="w-fit px-0">
          <Link href={`/${supabaseId}/integrations/webhooks`}>
            <ArrowLeft data-icon="inline-start" />
            Webhooks
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Webhook Genérico de Leads</h1>
        <p className="text-sm text-muted-foreground">
          Configure um endpoint para receber leads de ferramentas como Make, n8n ou qualquer integração HTTP POST
        </p>
      </div>

      <StudioWebhookIntegration />
    </div>
  );
}
