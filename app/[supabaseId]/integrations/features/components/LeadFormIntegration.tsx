"use client";

import { Copy, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIntegrationsContext } from "../context/IntegrationsContext";

export function LeadFormIntegration() {
  const { leadFormUrl, copyLeadFormUrl } = useIntegrationsContext();

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Formulário de Captação de Leads</h3>
          <p className="text-sm text-muted-foreground">
            Compartilhe este link para receber leads diretamente no seu board.
            O formulário permite cadastro de lead e agendamento de reunião com um closer do time.
          </p>
        </div>
      </div>

      {leadFormUrl ? (
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={leadFormUrl}
            className="font-mono text-xs"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={copyLeadFormUrl}
            title="Copiar URL"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            asChild
            title="Abrir formulário"
          >
            <a href={leadFormUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Selecione um time no menu lateral para gerar a URL do formulário.
        </p>
      )}
    </div>
  );
}
