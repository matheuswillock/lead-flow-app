"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import {
  Check,
  ChevronDown,
  CircleAlert,
  Clock,
  Copy,
  FileText,
  Info,
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useBackofficeIntegrations } from "../context/BackofficeIntegrationsHook"
import type {
  BackofficeMetaWebhookRequestLogItem,
  BackofficeMetaWebhookTokenHistoryItem,
  BackofficeWebhookTokenExpiryMode,
} from "../context/BackofficeIntegrationsTypes"

const expiryModeLabel: Record<BackofficeWebhookTokenExpiryMode, string> = {
  hours_24: "24 horas",
  months_6: "6 meses",
  indeterminate: "Indeterminado",
}

const metaLeadPayloadExample = `{
  "name": "Maria Silva",
  "email": "maria@email.com",
  "phone": "(11) 99999-9999",
  "notes": "Interesse em plano empresarial",
  "external_id": "meta-lead-123",
  "metadata": {
    "campaign": "Meta Ads",
    "form_id": "abc"
  }
}`

function formatDateTime(value: string | null): string {
  if (!value) return "-"

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return "-"

  return parsedDate.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  })
}

function formatTimeUntilExpiration(value: string | null): string | null {
  if (!value) return null

  const expiresAt = new Date(value)
  if (Number.isNaN(expiresAt.getTime())) return null

  const diffMs = expiresAt.getTime() - Date.now()
  if (diffMs <= 0) return "Expirado"

  const totalMinutes = Math.floor(diffMs / (1000 * 60))
  if (totalMinutes < 60) return `Expira em ${Math.max(totalMinutes, 1)}m`

  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) {
    const minutes = totalMinutes % 60
    return minutes > 0 ? `Expira em ${totalHours}h ${minutes}m` : `Expira em ${totalHours}h`
  }

  const totalDays = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours > 0 ? `Expira em ${totalDays}d ${hours}h` : `Expira em ${totalDays}d`
}

function formatPayloadForDetails(payload: unknown): string {
  if (typeof payload === "string") return payload
  if (typeof payload === "undefined") return "null"

  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return JSON.stringify({ serializationError: "unserializable_payload" }, null, 2)
  }
}

function getStatusBadgeVariant(
  statusCode: number
): "default" | "secondary" | "destructive" | "outline" {
  if (statusCode >= 200 && statusCode < 300) return "default"
  if (statusCode >= 400) return "destructive"
  if (statusCode >= 300) return "secondary"
  return "outline"
}

function getTokenStatusBadgeVariant(
  status: BackofficeMetaWebhookTokenHistoryItem["status"]
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default"
  if (status === "expired") return "destructive"
  return "secondary"
}

function getTokenStatusLabel(status: BackofficeMetaWebhookTokenHistoryItem["status"]): string {
  if (status === "active") return "Ativo"
  if (status === "expired") return "Expirado"
  return "Substituído"
}

export function BackofficeMetaIntegrationCard() {
  const {
    metaConfig,
    metaLogs,
    metaTokenHistory,
    tokenExpiryMode,
    isGeneratingToken,
    isLoadingLogs,
    setTokenExpiryMode,
    refreshLogs,
    generateMetaToken,
  } = useBackofficeIntegrations()
  const [copied, setCopied] = useState<"url" | null>(null)
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  const [openedAccordionItem, setOpenedAccordionItem] = useState<string>("meta-token")

  const selectedLog = useMemo<BackofficeMetaWebhookRequestLogItem | null>(() => {
    if (!selectedLogId) return metaLogs[0] ?? null
    return metaLogs.find((log) => log.id === selectedLogId) ?? metaLogs[0] ?? null
  }, [metaLogs, selectedLogId])

  useEffect(() => {
    if (!selectedLogId && metaLogs[0]) {
      setSelectedLogId(metaLogs[0].id)
      return
    }

    if (selectedLogId && !metaLogs.some((log) => log.id === selectedLogId)) {
      setSelectedLogId(metaLogs[0]?.id ?? null)
    }
  }, [metaLogs, selectedLogId])

  async function handleCopy(value: string | null) {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied("url")
      toast.success("URL copiada")
      setTimeout(() => setCopied((current) => (current === "url" ? null : current)), 1500)
    } catch (err) {
      console.error("[BackofficeMetaIntegrationCard][copy]", err)
      toast.error("Não foi possível copiar")
    }
  }

  const hasConcreteTokenUrl =
    Boolean(metaConfig?.configured && metaConfig.webhookUrl) &&
    !metaConfig?.webhookUrl.includes("{token}")
  const tokenStatusBadge = !metaConfig?.configured
    ? { label: "Token não configurado", variant: "outline" as const }
    : metaConfig.isExpired
      ? { label: "Expirado", variant: "destructive" as const }
      : { label: "Token ativo", variant: "default" as const }
  const expiresInLabel = metaConfig?.isExpired
    ? "Expirado"
    : formatTimeUntilExpiration(metaConfig?.expiresAt ?? null)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Webhook Meta (Corretor Studio)</CardTitle>
          <CardDescription>
            Endpoint exclusivo do backoffice para receber leads vindos do Make.
            A URL usa o token ativo gerado nesta tela.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <Accordion
          type="single"
          collapsible
          value={openedAccordionItem}
          onValueChange={setOpenedAccordionItem}
          className="flex w-full flex-col gap-4"
        >
          <AccordionItem value="meta-token" className="rounded-md border px-4">
            <AccordionPrimitive.Header className="flex w-full items-center gap-3 py-4">
              <AccordionPrimitive.Trigger className="flex min-w-0 flex-1 items-start text-left text-sm font-medium transition-all hover:no-underline">
                <div className="flex items-start gap-3 pr-3 text-left">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <KeyRound className="size-5 text-primary" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">Geração de token e autenticação</h3>
                      <Badge variant={tokenStatusBadge.variant}>{tokenStatusBadge.label}</Badge>
                      {expiresInLabel ? <Badge variant="secondary">{expiresInLabel}</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Gere um novo token automático para autenticar o webhook Meta do backoffice.
                    </p>
                  </div>
                </div>
              </AccordionPrimitive.Trigger>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-auto inline-flex shrink-0">
                      <Button
                        type="button"
                        onClick={() => void generateMetaToken()}
                        disabled={isGeneratingToken}
                        className="gap-2"
                      >
                        <RefreshCw data-icon className={cn(isGeneratingToken && "animate-spin")} />
                        {isGeneratingToken ? "Gerando..." : "Gerar / Regenerar Token"}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent align="end">
                    <p>Cada geração cria um novo registro no banco e substitui o token ativo anterior.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <AccordionPrimitive.Trigger className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&[data-state=open]>svg]:rotate-180">
                <ChevronDown className="size-4 transition-transform duration-200" />
                <span className="sr-only">Alternar detalhes de geração de token</span>
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>

            <AccordionContent className="pt-2">
              <div className="flex flex-col gap-5 pb-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="backoffice-meta-webhook-url">URL do webhook</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="backoffice-meta-webhook-url"
                      value={metaConfig?.webhookUrl ?? ""}
                      readOnly
                      className="font-mono text-xs"
                      placeholder="Gere um token para obter a URL final"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => void handleCopy(metaConfig?.webhookUrl ?? null)}
                      disabled={!hasConcreteTokenUrl}
                      title="Copiar URL do webhook"
                    >
                      {copied === "url" ? <Check data-icon /> : <Copy data-icon />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formato:{" "}
                    <code className="rounded bg-muted px-1 text-[11px]">
                      /api/webhooks/backoffice/meta/&lt;token&gt;/lead
                    </code>
                    . Apenas o token ativo autentica novas requisições.
                  </p>
                </div>

                <section className="flex flex-col gap-3 rounded-md border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-primary" />
                      <h4 className="text-sm font-semibold">Contrato do payload</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="default">name obrigatório</Badge>
                      <Badge variant="secondary">e-mail, phone, notes opcionais</Badge>
                      <Badge variant="secondary">external_id para idempotência</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Envie JSON direto pelo Make. O backoffice cria o lead com origem
                    Webhook Meta e salva o payload completo nos eventos.
                  </p>
                  <pre className="overflow-x-auto rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed">
                    {metaLeadPayloadExample}
                  </pre>
                </section>

                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="flex min-w-0 flex-col gap-3">
                    <TokenInfo
                      icon={<ShieldCheck className="size-4 text-primary" />}
                      label="Token ativo"
                      value={metaConfig?.tokenPreview ?? "Nenhum token gerado"}
                    />
                    <TokenInfo
                      icon={<Info className="size-4 text-primary" />}
                      label="Responsável"
                      value={metaConfig?.generatedByEmailSnapshot ?? "-"}
                    />
                    <TokenInfo
                      icon={<Clock className="size-4 text-primary" />}
                      label="Gerado em"
                      value={formatDateTime(metaConfig?.generatedAt ?? null)}
                    />
                  </section>

                  <section className="flex min-w-0 flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Label>Expiração do novo token</Label>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <Info className="size-4" />
                              <span className="sr-only">O que é expiração do token</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              A expiração vale para o próximo token gerado. Tokens expirados não autenticam o webhook.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <RadioGroup
                      value={tokenExpiryMode}
                      onValueChange={(value) =>
                        setTokenExpiryMode(value as BackofficeWebhookTokenExpiryMode)
                      }
                      className="grid gap-2"
                      disabled={isGeneratingToken}
                    >
                      {Object.entries(expiryModeLabel).map(([value, label]) => (
                        <label
                          key={value}
                          htmlFor={`backoffice-meta-expiry-${value}`}
                          className="flex cursor-pointer items-center gap-2 rounded-md border p-3"
                        >
                          <RadioGroupItem
                            id={`backoffice-meta-expiry-${value}`}
                            value={value}
                            disabled={isGeneratingToken}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </section>
                </div>

                <section className="flex min-w-0 flex-col gap-4 rounded-md border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-primary" />
                      <h4 className="text-sm font-semibold">Logs de criação do token</h4>
                    </div>
                    <Badge variant="secondary">{metaTokenHistory.length} registros</Badge>
                  </div>

                  <ScrollArea className="h-[360px] pr-3">
                    {metaTokenHistory.length === 0 ? (
                      <div className="flex h-[320px] items-center justify-center rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Nenhum token foi gerado ainda.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {metaTokenHistory.map((token) => (
                          <TokenHistoryItem key={token.id} token={token} />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </section>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="meta-logs" className="rounded-md border px-4">
            <AccordionTrigger className="py-4 hover:no-underline">
              <div className="flex items-start gap-3 pr-3 text-left">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <FileText className="size-5 text-primary" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">Logs de Webhook</h3>
                    <Badge variant="secondary">{metaLogs.length} registros</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Visualize tentativas HTTP, incluindo falhas de autenticação e payloads inválidos.
                  </p>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="pt-2">
              <div className="flex flex-col gap-4 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Lista dos últimos 15 recebimentos no endpoint público do backoffice.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void refreshLogs()}
                    disabled={isLoadingLogs}
                    className="gap-2"
                  >
                    <RefreshCw data-icon className={cn(isLoadingLogs && "animate-spin")} />
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
                          {isLoadingLogs ? (
                            Array.from({ length: 5 }).map((_, index) => (
                              <TableRow key={`backoffice-meta-log-skeleton-${index}`}>
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
                          ) : metaLogs.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="py-8 text-center text-sm text-muted-foreground">
                                Nenhum log de webhook encontrado.
                              </TableCell>
                            </TableRow>
                          ) : (
                            metaLogs.map((log) => {
                              const isSelected = selectedLog?.id === log.id

                              return (
                                <TableRow
                                  key={log.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setSelectedLogId(log.id)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault()
                                      setSelectedLogId(log.id)
                                    }
                                  }}
                                  className={cn("cursor-pointer", isSelected && "bg-muted/60")}
                                >
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      <p className="truncate font-medium">{log.endpoint}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatDateTime(log.createdAt)}
                                      </p>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Badge variant={getStatusBadgeVariant(log.statusCode)}>
                                      {log.statusCode}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              )
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
                    {selectedLog ? (
                      <ScrollArea className="h-[360px] p-4">
                        <div className="flex flex-col gap-4 pr-4">
                          <p className="break-all text-lg font-semibold leading-tight text-foreground">
                            {selectedLog.endpoint}
                          </p>

                          <div className="grid gap-3 text-sm md:grid-cols-3">
                            <LogInfo label="Data" value={formatDateTime(selectedLog.createdAt)} />
                            <LogInfo label="Método" value={selectedLog.method} />
                            <div className="flex flex-col gap-1">
                              <p className="font-semibold text-foreground">Status</p>
                              <Badge className="w-fit" variant={getStatusBadgeVariant(selectedLog.statusCode)}>
                                {selectedLog.statusCode}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <p className="text-sm font-semibold text-foreground">Conteúdo da requisição</p>
                            <pre className="max-h-[200px] overflow-x-auto rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed">
                              {formatPayloadForDetails(selectedLog.requestPayload)}
                            </pre>
                          </div>

                          <div className="flex flex-col gap-2">
                            <p className="text-sm font-semibold text-foreground">Conteúdo da resposta</p>
                            <pre className="max-h-[200px] overflow-x-auto rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed">
                              {formatPayloadForDetails(selectedLog.responsePayload)}
                            </pre>
                          </div>

                          {selectedLog.errorMessage ? (
                            <Alert variant="destructive">
                              <CircleAlert data-icon />
                              <AlertDescription>{selectedLog.errorMessage}</AlertDescription>
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
      </CardContent>
    </Card>
  )
}

function TokenInfo({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

function TokenHistoryItem({ token }: { token: BackofficeMetaWebhookTokenHistoryItem }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold">{token.tokenPreview}</p>
          <p className="text-xs text-muted-foreground">
            Gerado em {formatDateTime(token.generatedAt)}
          </p>
        </div>
        <Badge variant={getTokenStatusBadgeVariant(token.status)}>
          {getTokenStatusLabel(token.status)}
        </Badge>
      </div>

      <div className="grid gap-2 text-xs text-muted-foreground">
        <p className="truncate">
          <span className="font-medium text-foreground">Responsável:</span>{" "}
          {token.generatedByEmailSnapshot}
        </p>
        <p>
          <span className="font-medium text-foreground">Expiração:</span>{" "}
          {expiryModeLabel[token.expiryMode]}
          {token.expiresAt ? ` (${formatDateTime(token.expiresAt)})` : ""}
        </p>
        <p>
          <span className="font-medium text-foreground">Último uso:</span>{" "}
          {formatDateTime(token.lastUsedAt)}
        </p>
      </div>
    </div>
  )
}

function LogInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">{value}</p>
    </div>
  )
}
