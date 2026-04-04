"use client";

import { Copy, RefreshCcw, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useIntegrationsContext } from "../context/IntegrationsContext";

const expiryModeLabel: Record<"hours_24" | "months_6" | "indeterminate", string> = {
  hours_24: "24 horas",
  months_6: "6 meses",
  indeterminate: "Indeterminado",
};

const tokenModeLabel: Record<"manual" | "auto", string> = {
  manual: "Token manual",
  auto: "Token automático",
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "Não expira";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-BR");
};

export function StudioWebhookIntegration() {
  const {
    activeTeamId,
    studioWebhookConfig,
    studioWebhookTokenMode,
    studioWebhookManualToken,
    studioWebhookExpiryMode,
    studioWebhookGeneratedUrl,
    studioWebhookLoading,
    studioWebhookSaving,
    studioWebhookContractJson,
    setStudioWebhookTokenMode,
    setStudioWebhookManualToken,
    setStudioWebhookExpiryMode,
    saveStudioWebhookConfig,
    copyStudioWebhookUrl,
    copyStudioWebhookContract,
  } = useIntegrationsContext();

  const urlToDisplay = studioWebhookGeneratedUrl || studioWebhookConfig?.webhookUrlTemplate || "";
  const hasConcreteTokenUrl = !!studioWebhookGeneratedUrl;
  const hasExistingConfig = studioWebhookConfig?.configured === true;

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Webhook className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Webhook Genérico de Leads</h3>
          <p className="text-sm text-muted-foreground">
            Configure um endpoint para receber leads de ferramentas como Make, n8n ou qualquer integração HTTP POST.
          </p>
        </div>
      </div>

      {!activeTeamId ? (
        <p className="text-sm text-muted-foreground">
          Selecione um time no menu lateral para configurar o webhook.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="studio-webhook-token-mode">Modo do token</Label>
              <Select
                value={studioWebhookTokenMode}
                onValueChange={(value: "manual" | "auto") => setStudioWebhookTokenMode(value)}
                disabled={studioWebhookSaving}
              >
                <SelectTrigger id="studio-webhook-token-mode">
                  <SelectValue placeholder="Selecione o modo do token" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{tokenModeLabel.auto}</SelectItem>
                  <SelectItem value="manual">{tokenModeLabel.manual}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="studio-webhook-expiry-mode">Expiração do token</Label>
              <Select
                value={studioWebhookExpiryMode}
                onValueChange={(value: "hours_24" | "months_6" | "indeterminate") =>
                  setStudioWebhookExpiryMode(value)
                }
                disabled={studioWebhookSaving}
              >
                <SelectTrigger id="studio-webhook-expiry-mode">
                  <SelectValue placeholder="Selecione a expiração" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours_24">{expiryModeLabel.hours_24}</SelectItem>
                  <SelectItem value="months_6">{expiryModeLabel.months_6}</SelectItem>
                  <SelectItem value="indeterminate">{expiryModeLabel.indeterminate}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {studioWebhookTokenMode === "manual" ? (
            <div className="space-y-2">
              <Label htmlFor="studio-webhook-manual-token">Token manual</Label>
              <Input
                id="studio-webhook-manual-token"
                value={studioWebhookManualToken}
                onChange={(event) => setStudioWebhookManualToken(event.target.value)}
                placeholder="Cole o token que deseja usar no webhook"
                disabled={studioWebhookSaving}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="studio-webhook-url">URL do webhook</Label>
            <div className="flex items-center gap-2">
              <Input
                id="studio-webhook-url"
                readOnly
                value={urlToDisplay}
                className="font-mono text-xs"
                placeholder="Salve a configuração para gerar a URL completa"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyStudioWebhookUrl}
                title="Copiar URL do webhook"
                disabled={!urlToDisplay}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {!hasConcreteTokenUrl ? (
              <p className="text-xs text-muted-foreground">
                A URL acima é um template. Salve ou regenere o token para obter a URL final com token.
              </p>
            ) : null}
          </div>

          <div className="rounded-md border p-3 text-sm">
            <p>
              <span className="font-medium">Status:</span>{" "}
              {studioWebhookLoading
                ? "Carregando..."
                : studioWebhookConfig?.isExpired
                  ? "Token expirado"
                  : hasExistingConfig
                    ? "Configurado"
                    : "Não configurado"}
            </p>
            <p>
              <span className="font-medium">Token atual:</span>{" "}
              {studioWebhookConfig?.tokenPreview || "Ainda não configurado"}
            </p>
            <p>
              <span className="font-medium">Expiração:</span>{" "}
              {studioWebhookConfig
                ? `${expiryModeLabel[studioWebhookConfig.expiryMode]} (${formatDateTime(studioWebhookConfig.expiresAt)})`
                : "Não configurado"}
            </p>
          </div>

          <Button onClick={saveStudioWebhookConfig} disabled={studioWebhookSaving || studioWebhookLoading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            {studioWebhookSaving
              ? "Salvando..."
              : hasExistingConfig
                ? "Salvar / Regenerar Token"
                : "Salvar Configuração do Webhook"}
          </Button>
        </div>
      )}

      <Accordion type="single" collapsible defaultValue="studio-webhook-contract">
        <AccordionItem value="studio-webhook-contract">
          <AccordionTrigger>Contrato JSON do webhook</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Use este modelo em inglês para enviar eventos ao webhook.
              </p>
              <div className="rounded-md border bg-muted/40 p-3">
                <pre className="text-xs whitespace-pre-wrap font-mono">{studioWebhookContractJson}</pre>
              </div>
              <Button variant="outline" onClick={copyStudioWebhookContract}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar modelo
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
