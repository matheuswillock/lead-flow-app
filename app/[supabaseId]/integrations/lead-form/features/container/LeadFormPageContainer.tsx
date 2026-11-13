"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIntegrationsContext } from "@/app/[supabaseId]/integrations/features/context/IntegrationsContext";
import { LeadFormIntegration } from "@/app/[supabaseId]/integrations/features/components/LeadFormIntegration";
import { useLeadFormPage } from "../context/LeadFormPageHook";
import { LeadFormPageSkeleton } from "../components/LeadFormPageSkeleton";

export function LeadFormPageContainer() {
  const { supabaseId } = useIntegrationsContext();
  const { hasLeadFormAccess, isLoading } = useLeadFormPage();

  if (isLoading) {
    return <LeadFormPageSkeleton />;
  }

  if (!hasLeadFormAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Formulário de Captação de Leads</h1>
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
        <Button variant="ghost" size="sm" asChild className="min-h-11 w-fit px-0">
          <Link href={`/${supabaseId}/integrations`}>
            <ArrowLeft data-icon="inline-start" />
            Integrações
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Formulário de Captação de Leads</h1>
        <p className="text-sm text-muted-foreground">
          Compartilhe este link para receber leads diretamente no seu board. O formulário permite cadastro de lead e
          agendamento de reunião com um closer do time.
        </p>
      </div>

      <LeadFormIntegration />
    </div>
  );
}
