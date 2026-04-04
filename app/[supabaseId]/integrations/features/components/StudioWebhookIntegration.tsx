"use client";

import type { ReactNode } from "react";
import { CircleAlert, Copy, Info, Save, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

const tokenModeLabel: Record<"manual" | "auto" | "none", string> = {
  manual: "Token manual",
  auto: "Token automático",
  none: "Sem token",
};

type WebhookStatusBadgeConfig = {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
};

type WebhookExpiryBadgeConfig = {
  label: string;
  variant: "secondary" | "destructive";
};

const JSON_TOKEN_REGEX =
  /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g;

const renderStudioJsonSnippet = (json: string): ReactNode[] =>
  json.split("\n").map((line, lineIndex) => {
    const tokens: ReactNode[] = [];
    let lastIndex = 0;
    const matches = line.matchAll(JSON_TOKEN_REGEX);

    for (const match of matches) {
      const token = match[0];
      const startIndex = match.index ?? 0;

      if (startIndex > lastIndex) {
        tokens.push(
          <span key={`plain-${lineIndex}-${lastIndex}`} className="text-[#f8f8f2]">
            {line.slice(lastIndex, startIndex)}
          </span>
        );
      }

      let tokenClassName = "text-[#f8f8f2]";
      if (token.startsWith('"')) {
        tokenClassName = token.trimEnd().endsWith(":") ? "text-[#8be9fd]" : "text-[#f1fa8c]";
      } else if (token === "true" || token === "false" || token === "null") {
        tokenClassName = "text-[#ff79c6]";
      } else {
        tokenClassName = "text-[#bd93f9]";
      }

      tokens.push(
        <span key={`token-${lineIndex}-${startIndex}`} className={tokenClassName}>
          {token}
        </span>
      );

      lastIndex = startIndex + token.length;
    }

    if (lastIndex < line.length) {
      tokens.push(
          <span key={`tail-${lineIndex}-${lastIndex}`} className="text-[#f8f8f2]">
          {line.slice(lastIndex)}
        </span>
      );
    }

    return (
      <div key={`line-${lineIndex}`} className="leading-6">
        {tokens}
      </div>
    );
  });

const formatTimeUntilExpiration = (expiresAtIso: string | null): string | null => {
  if (!expiresAtIso) return null;

  const expiresAt = new Date(expiresAtIso);
  if (Number.isNaN(expiresAt.getTime())) return null;

  const diffMs = expiresAt.getTime() - Date.now();
  if (diffMs <= 0) return "Expirado";

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  if (totalMinutes < 60) {
    return `Expira em ${Math.max(totalMinutes, 1)}m`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `Expira em ${totalHours}h ${minutes}m` : `Expira em ${totalHours}h`;
  }

  const totalDays = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours > 0 ? `Expira em ${totalDays}d ${hours}h` : `Expira em ${totalDays}d`;
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

  const urlToDisplay =
    studioWebhookGeneratedUrl || studioWebhookConfig?.webhookUrl || studioWebhookConfig?.webhookUrlTemplate || "";
  const hasTokenPlaceholder = urlToDisplay.includes("[token]");
  const hasConcreteTokenUrl = Boolean(urlToDisplay) && !hasTokenPlaceholder;
  const hasExistingConfig = studioWebhookConfig?.configured === true;
  const renderedContractJson = renderStudioJsonSnippet(studioWebhookContractJson);
  const isManualTokenFilled = studioWebhookTokenMode !== "manual" || studioWebhookManualToken.trim().length > 0;
  const canSaveWebhookConfig =
    Boolean(activeTeamId) && isManualTokenFilled && !studioWebhookSaving && !studioWebhookLoading;

  const webhookStatusBadge: WebhookStatusBadgeConfig = studioWebhookLoading
    ? { label: "Verificando configuração", variant: "secondary" }
    : !hasExistingConfig
      ? { label: "Token não configurado", variant: "outline" }
      : studioWebhookConfig?.isExpired
        ? { label: "Expirado", variant: "destructive" }
        : { label: "Pronto para uso", variant: "default" };

  const webhookExpiryBadge: WebhookExpiryBadgeConfig | null = (() => {
    if (!studioWebhookConfig || studioWebhookConfig.expiryMode === "indeterminate") {
      return null;
    }

    if (studioWebhookConfig.isExpired) {
      return { label: "Expirado", variant: "destructive" };
    }

    const expiresInLabel = formatTimeUntilExpiration(studioWebhookConfig.expiresAt);
    if (!expiresInLabel) return null;
    if (expiresInLabel === "Expirado") {
      return { label: "Expirado", variant: "destructive" };
    }

    return { label: expiresInLabel, variant: "secondary" };
  })();

  return (
    <div className="rounded-lg border p-6">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="studio-webhook-settings" className="border-b-0">
          <AccordionTrigger className="py-0 hover:no-underline">
            <div className="flex items-start gap-3 pr-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Webhook className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">Webhook Genérico de Leads</h3>
                  <Badge variant={webhookStatusBadge.variant}>{webhookStatusBadge.label}</Badge>
                  {webhookExpiryBadge ? <Badge variant={webhookExpiryBadge.variant}>{webhookExpiryBadge.label}</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  Configure um endpoint para receber leads de ferramentas como Make, n8n ou qualquer integração HTTP
                  POST.
                </p>
              </div>
            </div>
          </AccordionTrigger>

          <div className="mt-4 space-y-2">
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
            {!activeTeamId ? (
              <p className="text-xs text-muted-foreground">
                Selecione um time no menu lateral para configurar o webhook.
              </p>
            ) : !hasConcreteTokenUrl ? (
              <p className="text-xs text-muted-foreground">
                A URL acima é um template. Salve a configuração para gerar a URL final conforme o modo selecionado.
              </p>
            ) : null}
          </div>

          <AccordionContent className="pt-4">
            {activeTeamId ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Modo do token</Label>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground transition-colors hover:text-foreground">
                              <Info className="size-4" />
                              <span className="sr-only">O que é modo do token</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Escolha entre gerar um token automaticamente pelo sistema ou definir manualmente um token
                              próprio para o webhook. Recomendamos manter token ativo para proteger o endpoint.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <RadioGroup
                      value={studioWebhookTokenMode}
                      onValueChange={(value: "manual" | "auto" | "none") => setStudioWebhookTokenMode(value)}
                      className="grid gap-2"
                      disabled={studioWebhookSaving}
                    >
                      <label
                        htmlFor="studio-webhook-token-auto"
                        className="flex cursor-pointer items-center gap-2 rounded-md border p-3"
                      >
                        <RadioGroupItem
                          id="studio-webhook-token-auto"
                          value="auto"
                          disabled={studioWebhookSaving}
                        />
                        <span>{tokenModeLabel.auto}</span>
                      </label>
                      <label
                        htmlFor="studio-webhook-token-manual"
                        className="flex cursor-pointer items-center gap-2 rounded-md border p-3"
                      >
                        <RadioGroupItem
                          id="studio-webhook-token-manual"
                          value="manual"
                          disabled={studioWebhookSaving}
                        />
                        <span>{tokenModeLabel.manual}</span>
                      </label>
                      <label
                        htmlFor="studio-webhook-token-none"
                        className="flex cursor-pointer items-center gap-2 rounded-md border p-3"
                      >
                        <RadioGroupItem
                          id="studio-webhook-token-none"
                          value="none"
                          disabled={studioWebhookSaving}
                        />
                        <span>{tokenModeLabel.none}</span>
                      </label>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Expiração do token</Label>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground transition-colors hover:text-foreground">
                              <Info className="size-4" />
                              <span className="sr-only">O que é expiração do token</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Define por quanto tempo o token do webhook será válido: 24 horas, 6 meses ou sem
                              expiração.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <RadioGroup
                      value={studioWebhookExpiryMode}
                      onValueChange={(value: "hours_24" | "months_6" | "indeterminate") =>
                        setStudioWebhookExpiryMode(value)
                      }
                      className="grid gap-2"
                      disabled={studioWebhookSaving}
                    >
                      <label
                        htmlFor="studio-webhook-expiry-24h"
                        className="flex cursor-pointer items-center gap-2 rounded-md border p-3"
                      >
                        <RadioGroupItem
                          id="studio-webhook-expiry-24h"
                          value="hours_24"
                          disabled={studioWebhookSaving}
                        />
                        <span>{expiryModeLabel.hours_24}</span>
                      </label>
                      <label
                        htmlFor="studio-webhook-expiry-6m"
                        className="flex cursor-pointer items-center gap-2 rounded-md border p-3"
                      >
                        <RadioGroupItem
                          id="studio-webhook-expiry-6m"
                          value="months_6"
                          disabled={studioWebhookSaving}
                        />
                        <span>{expiryModeLabel.months_6}</span>
                      </label>
                      <label
                        htmlFor="studio-webhook-expiry-indeterminate"
                        className="flex cursor-pointer items-center gap-2 rounded-md border p-3"
                      >
                        <RadioGroupItem
                          id="studio-webhook-expiry-indeterminate"
                          value="indeterminate"
                          disabled={studioWebhookSaving}
                        />
                        <span>{expiryModeLabel.indeterminate}</span>
                      </label>
                    </RadioGroup>
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

                <Button onClick={saveStudioWebhookConfig} disabled={!canSaveWebhookConfig}>
                  <Save className="h-4 w-4 mr-2" />
                  {studioWebhookSaving
                    ? "Salvando..."
                    : hasExistingConfig && studioWebhookTokenMode !== "none"
                      ? "Salvar / Regenerar Token"
                      : "Salvar Configuração do Webhook"}
                </Button>
              </div>
            ) : null}

            <div className="mt-4 space-y-3 border-t pt-4">
              <h4 className="text-sm font-semibold">Contrato JSON do webhook</h4>
              <p className="text-sm text-muted-foreground">Use este para enviar eventos ao webhook do seu corretor studio.</p>
              <div className="group relative overflow-x-auto rounded-md border border-[#44475a] bg-[#282a36] p-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="pointer-events-none absolute right-3 top-3 z-10 h-8 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
                  onClick={copyStudioWebhookContract}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar modelo
                </Button>
                <pre className="pr-24 font-mono text-xs">{renderedContractJson}</pre>
              </div>
              <Alert>
                <CircleAlert className="h-4 w-4" />
                <AlertDescription className="flex flex-col gap-1">
                  <p>
                    Obrigatórios: <strong>name</strong>, <strong>email</strong> e <strong>phone</strong>.
                  </p>
                  <p>
                    Opcionais: <strong>cnpj</strong>, <strong>ages</strong>, <strong>current_health_plan</strong>,{" "}
                    <strong>current_value</strong>, <strong>reference_hospital</strong>, <strong>current_treatment</strong>,{" "}
                    <strong>source</strong> e <strong>metadata</strong> (incluindo <strong>ad_id</strong>,{" "}
                    <strong>page_id</strong>, <strong>lead_id</strong>, <strong>created_time</strong> e{" "}
                    <strong>form_name</strong>).
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
