"use client";

import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIntegrationsContext } from "../context/IntegrationsContext";

export function LeadFormIntegration() {
  const { leadFormUrl, leadFormFullUrl, copyLeadFormUrl } = useIntegrationsContext();

  return (
    <div className="rounded-lg border p-6 space-y-4">
      {leadFormUrl ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={leadFormUrl}
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              className="min-h-11 min-w-11"
              onClick={copyLeadFormUrl}
              title="Copiar URL"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="min-h-11 min-w-11"
              asChild
              title="Abrir formulário"
            >
              <a href={leadFormUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          {leadFormFullUrl && (
            // SPEC 40 B-E2 (W25): destino real por trás do link curto — o
            // link copiado continua sendo o curto acima.
            <p className="truncate text-xs text-muted-foreground" title={leadFormFullUrl}>
              Destino: <span className="font-mono">{leadFormFullUrl}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Selecione um time no menu lateral para gerar a URL do formulário.
        </p>
      )}
    </div>
  );
}
