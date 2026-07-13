"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CircleAlert, Copy, FileText, Info, RefreshCcw, Save, Webhook } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useIntegrationsContext } from "../context/IntegrationsContext";
import type { StudioWebhookLogItem } from "../services/IIntegrationsService";
import { useTimezone } from "@/app/context/TimezoneContext";
import { formatIntimezone } from "@/lib/dates"

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
          <span key={`plain-${lineIndex}-${lastIndex}`} className="text-foreground">
            {line.slice(lastIndex, startIndex)}
          </span>
        );
      }

      let tokenClassName = "text-foreground";
      if (token.startsWith('"')) {
        tokenClassName = token.trimEnd().endsWith(":")
          ? "text-semantic-info"
          : "text-semantic-warning";
      } else if (token === "true" || token === "false" || token === "null") {
        tokenClassName = "text-semantic-danger";
      } else {
        tokenClassName = "text-precision-indigo";
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
        <span key={`tail-${lineIndex}-${lastIndex}`} className="text-foreground">
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

const formatWebhookLogDateTime = (value: string, tz: string): string => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return formatIntimezone(parsedDate, "dd/MM/yyyy HH:mm:ss", tz);
};

const formatPayloadForDetails = (payload: unknown): string => {
  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload === "undefined") {
    return "null";
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return JSON.stringify(
      {
        serializationError: "unserializable_payload",
      },
      null,
      2
    );
  }
};

const getWebhookLogStatusBadgeVariant = (statusCode: number): "default" | "secondary" | "destructive" | "outline" => {
  if (statusCode >= 200 && statusCode < 300) {
    return "default";
  }

  if (statusCode >= 400) {
    return "destructive";
  }

  if (statusCode >= 300) {
    return "secondary";
  }

  return "outline";
};

export function StudioWebhookIntegration() {
  const { tz } = useTimezone();
  const {
    activeTeamId,
    studioWebhookConfig,
    studioWebhookTokenMode,
    studioWebhookManualToken,
    studioWebhookExpiryMode,
    studioWebhookGeneratedUrl,
    studioWebhookLoading,
    studioWebhookSaving,
    studioWebhookLogs,
    studioWebhookLogsLoading,
    selectedStudioWebhookLogId,
    studioWebhookContractJson,
    setStudioWebhookTokenMode,
    setStudioWebhookManualToken,
    setStudioWebhookExpiryMode,
    setSelectedStudioWebhookLogId,
    loadStudioWebhookLogs,
    saveStudioWebhookConfig,
    copyStudioWebhookUrl,
    copyStudioWebhookContract,
  } = useIntegrationsContext();
  const [openedAccordionItem, setOpenedAccordionItem] = useState<string>("studio-webhook-settings");

  const urlToDisplay =
    studioWebhookGeneratedUrl || studioWebhookConfig?.webhookUrl || studioWebhookConfig?.webhookUrlTemplate || "";
  const hasTokenPlaceholder = urlToDisplay.includes("[token]");
  const hasConcreteTokenUrl = Boolean(urlToDisplay) && !hasTokenPlaceholder;
  const hasExistingConfig = studioWebhookConfig?.configured === true;
  const renderedContractJson = renderStudioJsonSnippet(studioWebhookContractJson);
  const isManualTokenFilled = studioWebhookTokenMode !== "manual" || studioWebhookManualToken.trim().length > 0;
  const canSaveWebhookConfig =
    Boolean(activeTeamId) && isManualTokenFilled && !studioWebhookSaving && !studioWebhookLoading;
  const selectedStudioWebhookLog = useMemo<StudioWebhookLogItem | null>(() => {
    if (!selectedStudioWebhookLogId) {
      return studioWebhookLogs[0] ?? null;
    }

    return studioWebhookLogs.find((log) => log.id === selectedStudioWebhookLogId) ?? studioWebhookLogs[0] ?? null;
  }, [selectedStudioWebhookLogId, studioWebhookLogs]);

  useEffect(() => {
    if (openedAccordionItem !== "studio-webhook-logs") {
      return;
    }

    void loadStudioWebhookLogs();
  }, [loadStudioWebhookLogs, openedAccordionItem]);

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
      <Accordion
        type="single"
        collapsible
        value={openedAccordionItem}
        onValueChange={setOpenedAccordionItem}
        className="w-full space-y-4"
      >
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
              <div className="group relative overflow-x-auto rounded-md border border-border bg-muted/70 p-3">
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
                    Obrigatórios: <strong>name</strong>, <strong>e-mail</strong> e <strong>phone</strong>.
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

        <AccordionItem value="studio-webhook-logs" className="border-b-0">
          <AccordionTrigger className="py-0 hover:no-underline">
            <div className="flex items-start gap-3 pr-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">Logs de Webhook</h3>
                  <Badge variant="secondary">{studioWebhookLogs.length} registros</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Visualize os últimos 15 recebimentos do webhook com status e payload completo.
                </p>
              </div>
            </div>
          </AccordionTrigger>

          <AccordionContent className="pt-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Lista fixa dos 15 últimos eventos recebidos no endpoint do webhook.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadStudioWebhookLogs({ force: true })}
                  disabled={!activeTeamId || studioWebhookLogsLoading}
                >
                  <RefreshCcw className={cn("mr-2 h-4 w-4", studioWebhookLogsLoading && "animate-spin")} />
                  Atualizar logs
                </Button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="rounded-md border">
                  <div className="border-b px-3 py-2">
                    <p className="text-sm font-semibold">Recebimentos</p>
                  </div>

                  <ScrollArea className="h-[360px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="w-[120px] text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studioWebhookLogsLoading ? (
                          Array.from({ length: 5 }).map((_, index) => (
                            <TableRow key={`studio-webhook-log-skeleton-${index}`}>
                              <TableCell>
                                <div className="flex flex-col gap-2 py-1">
                                  <Skeleton className="h-4 w-[90%]" />
                                  <Skeleton className="h-3 w-[45%]" />
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Skeleton className="ml-auto h-7 w-16" />
                              </TableCell>
                            </TableRow>
                          ))
                        ) : studioWebhookLogs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="py-8 text-center text-sm text-muted-foreground">
                              Nenhum log de webhook encontrado para este time.
                            </TableCell>
                          </TableRow>
                        ) : (
                          studioWebhookLogs.map((log) => {
                            const isSelected = selectedStudioWebhookLog?.id === log.id;

                            return (
                              <TableRow
                                key={log.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedStudioWebhookLogId(log.id)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setSelectedStudioWebhookLogId(log.id);
                                  }
                                }}
                                className={cn("cursor-pointer", isSelected && "bg-muted/60")}
                              >
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    <p className="truncate font-medium">{log.endpoint}</p>
                                    <p className="text-xs text-muted-foreground">{formatWebhookLogDateTime(log.createdAt, tz)}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={getWebhookLogStatusBadgeVariant(log.statusCode)}>{log.statusCode}</Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>

                <div className="rounded-md border">
                  <div className="border-b px-3 py-2">
                    <p className="text-sm font-semibold">Detalhes</p>
                  </div>

                  {selectedStudioWebhookLog ? (
                    <ScrollArea className="h-[360px] p-4">
                      <div className="flex flex-col gap-4 pr-4">
                        <p className="break-all text-3xl font-semibold leading-tight text-foreground">
                          {selectedStudioWebhookLog.endpoint}
                        </p>

                        <div className="flex flex-col gap-3 text-sm">
                          <div className="flex flex-col gap-1">
                            <p className="font-semibold text-foreground">Data da requisição</p>
                            <p className="text-muted-foreground">{formatWebhookLogDateTime(selectedStudioWebhookLog.createdAt, tz)}</p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className="font-semibold text-foreground">Status</p>
                            <Badge className="w-fit" variant={getWebhookLogStatusBadgeVariant(selectedStudioWebhookLog.statusCode)}>
                              {selectedStudioWebhookLog.statusCode}
                            </Badge>
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className="font-semibold text-foreground">Método</p>
                            <p className="text-muted-foreground">{selectedStudioWebhookLog.method}</p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <p className="text-sm font-semibold text-foreground">Conteúdo da requisição</p>
                          <pre className="max-h-[200px] overflow-x-auto rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed">
                            {formatPayloadForDetails(selectedStudioWebhookLog.requestPayload)}
                          </pre>
                        </div>

                        <div className="flex flex-col gap-2">
                          <p className="text-sm font-semibold text-foreground">Conteúdo da resposta</p>
                          <pre className="max-h-[200px] overflow-x-auto rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed">
                            {formatPayloadForDetails(selectedStudioWebhookLog.responsePayload)}
                          </pre>
                        </div>

                        {selectedStudioWebhookLog.errorMessage ? (
                          <Alert variant="destructive">
                            <CircleAlert className="h-4 w-4" />
                            <AlertDescription>{selectedStudioWebhookLog.errorMessage}</AlertDescription>
                          </Alert>
                        ) : null}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex h-[360px] items-center justify-center p-6">
                      <p className="text-sm text-muted-foreground">
                        Selecione um log na tabela para visualizar os detalhes completos.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
