"use client"

import { CalendarClock, CircleAlert, ExternalLink, RefreshCcw, RotateCcw } from "lucide-react"
import { useState, type KeyboardEvent } from "react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatIntimezone } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { TeamWebhookLogItem } from "../services/ITeamWebhooksService"
import { WEBHOOK_EVENT_OPTIONS } from "../services/ITeamWebhooksService"
import { readInboundLogOutcome, shortEventId } from "./inboundLogResult"

type WebhookLogsPanelProps = {
  logs: TeamWebhookLogItem[]
  selectedLogId: string | null
  timezone: string
  isLoading: boolean
  isRefreshing: boolean
  resendingLogId: string | null
  canResend: boolean
  /** Com o id do usuário, o detalhe de um evento v2 linka o lead no CRM. */
  supabaseId?: string
  onSelect: (logId: string) => void
  onRefresh: () => void
  onResend: (log: TeamWebhookLogItem) => void
}

const eventLabels = new Map(WEBHOOK_EVENT_OPTIONS.map((event) => [event.value, event.label]))

const resultConfig = {
  success: { label: "Sucesso", variant: "default" as const },
  failure: { label: "Falha", variant: "destructive" as const },
  rejected: { label: "Rejeitado", variant: "secondary" as const },
}

function formatPayload(payload: unknown): string {
  if (typeof payload === "string") return payload
  if (typeof payload === "undefined") return "null"
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return JSON.stringify({ serializationError: "unserializable_payload" }, null, 2)
  }
}

function rowSuffix(log: TeamWebhookLogItem): string {
  const outcome = readInboundLogOutcome(log.responsePayload)
  if (!outcome) return ""
  const id = shortEventId(outcome.eventId)
  return `${id ? ` · evento ${id}` : ""}${outcome.replay ? " · reenvio" : ""}`
}

function formatLogDate(value: string, timezone: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return formatIntimezone(date, "dd/MM/yyyy HH:mm:ss", timezone)
}

function eventLabel(log: TeamWebhookLogItem): string {
  const outcome = readInboundLogOutcome(log.responsePayload)
  if (outcome) return outcome.label
  return log.eventKey ? (eventLabels.get(log.eventKey) ?? log.eventKey) : "Teste de envio"
}

export function WebhookLogsPanel({
  logs,
  selectedLogId,
  timezone,
  isLoading,
  isRefreshing,
  resendingLogId,
  canResend,
  supabaseId,
  onSelect,
  onRefresh,
  onResend,
}: WebhookLogsPanelProps) {
  const selectedLog = logs.find((log) => log.id === selectedLogId) ?? logs[0] ?? null
  // Webhook de entrada (SPEC 10 B-E3): o detalhe de cada evento abre num Sheet, sem painel lateral.
  const isInbound = logs[0]?.direction === "inbound"
  const [detailLogId, setDetailLogId] = useState<string | null>(null)
  const detailLog = logs.find((log) => log.id === detailLogId) ?? null

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            As entregas são processadas de forma assíncrona e podem levar até cinco minutos.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCcw
              data-icon="inline-start"
              className={cn(isRefreshing && "animate-spin motion-reduce:animate-none")}
            />
            Atualizar logs
          </Button>
        </div>

        <div className={cn("grid min-w-0 gap-4", !isInbound && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]")}>
          <div className="min-w-0 rounded-md border">
            <div className="border-b px-3 py-2">
              <p className="text-sm font-semibold">Entregas</p>
            </div>
            <ScrollArea className="h-[360px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead className="w-[104px] text-right">Resultado</TableHead>
                    <TableHead className="w-[52px] text-right">
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={`webhook-log-skeleton-${index}`}>
                        <TableCell>
                          <div className="flex flex-col gap-2 py-1">
                            <Skeleton className="h-4 w-[80%]" />
                            <Skeleton className="h-3 w-[55%]" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="ml-auto h-6 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="ml-auto size-9" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma tentativa de entrega registrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => {
                      const isSelected = selectedLog?.id === log.id
                      const resendUnavailable = !canResend || log.requestPayload === null
                      const resendLabel =
                        log.requestPayload === null
                          ? "Reenvio indisponível: registro sem payload"
                          : canResend
                            ? "Reenviar webhook"
                            : "Ative o webhook antes de reenviar"

                      return (
                        <TableRow
                          key={log.id}
                          {...(isInbound
                            ? {}
                            : {
                                role: "button",
                                tabIndex: 0,
                                className: cn("cursor-pointer", isSelected && "bg-muted/60"),
                                onClick: () => onSelect(log.id),
                                onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
                                  if (event.target !== event.currentTarget) return
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault()
                                    onSelect(log.id)
                                  }
                                },
                              })}
                        >
                          <TableCell className="min-w-0">
                            <div className="flex min-w-0 flex-col gap-1">
                              <p className="truncate font-medium">{eventLabel(log)}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatLogDate(log.createdAt, timezone)}
                                {rowSuffix(log)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={resultConfig[log.result].variant}>
                              {resultConfig[log.result].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {log.direction === "inbound" ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="min-h-11"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setDetailLogId(log.id)
                                }}
                              >
                                Ver detalhes
                              </Button>
                            ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-11"
                                  aria-label={resendLabel}
                                  disabled={resendUnavailable || resendingLogId !== null}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    onResend(log)
                                  }}
                                >
                                  <RotateCcw
                                    className={cn(
                                      resendingLogId === log.id &&
                                        "animate-spin motion-reduce:animate-none",
                                    )}
                                  />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{resendLabel}</TooltipContent>
                            </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {isInbound ? null : (
          <div className="min-w-0 rounded-md border">
            <div className="border-b px-3 py-2">
              <p className="text-sm font-semibold">Detalhes</p>
            </div>
            {selectedLog ? (
              <ScrollArea className="h-[360px] p-4" viewportClassName="[&>div]:!block">
                <div className="flex min-w-0 flex-col gap-4 pr-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold">{eventLabel(selectedLog)}</p>
                    <p className="break-all text-xs text-muted-foreground">
                      {selectedLog.endpoint ?? "Endpoint não registrado"}
                    </p>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div className="flex flex-col gap-1">
                      <dt className="font-semibold">Data</dt>
                      <dd className="text-muted-foreground">
                        {formatLogDate(selectedLog.createdAt, timezone)}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <dt className="font-semibold">Resultado</dt>
                      <dd>
                        <Badge variant={resultConfig[selectedLog.result].variant}>
                          {resultConfig[selectedLog.result].label}
                        </Badge>
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <dt className="font-semibold">HTTP</dt>
                      <dd className="text-muted-foreground">{selectedLog.statusCode ?? "-"}</dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <dt className="font-semibold">Método</dt>
                      <dd className="text-muted-foreground">{selectedLog.method ?? "-"}</dd>
                    </div>
                  </dl>

                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-sm font-semibold">Conteúdo da requisição</p>
                    <pre className="max-h-[200px] max-w-full overflow-auto rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed">
                      {formatPayload(selectedLog.requestPayload)}
                    </pre>
                  </div>
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-sm font-semibold">Conteúdo da resposta</p>
                    <pre className="max-h-[200px] max-w-full overflow-auto rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed">
                      {formatPayload(selectedLog.responsePayload)}
                    </pre>
                  </div>
                  {selectedLog.errorMessage ? (
                    <Alert variant="destructive">
                      <CircleAlert />
                      <AlertDescription>{selectedLog.errorMessage}</AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex h-[360px] items-center justify-center p-6">
                <p className="text-center text-sm text-muted-foreground">
                  Selecione um log para visualizar os detalhes completos.
                </p>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
      <LogDetailSheet
        log={detailLog}
        timezone={timezone}
        supabaseId={supabaseId}
        onClose={() => setDetailLogId(null)}
      />
    </TooltipProvider>
  )
}

/** Detalhe de um evento recebido (SPEC 10 B-E3): payload já mascarado pela API, ou o estado "sem dados". */
function LogDetailSheet({
  log,
  timezone,
  supabaseId,
  onClose,
}: {
  log: TeamWebhookLogItem | null
  timezone: string
  supabaseId?: string
  onClose: () => void
}) {
  return (
    <Sheet open={log !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Detalhe do log</SheetTitle>
          <SheetDescription>
            {log ? formatLogDate(log.createdAt, timezone) : null}
          </SheetDescription>
        </SheetHeader>
        {log ? (
          <div className="flex min-w-0 flex-col gap-4 px-4 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={resultConfig[log.result].variant}>{resultConfig[log.result].label}</Badge>
              {log.statusCode ? <span className="text-sm text-muted-foreground">HTTP {log.statusCode}</span> : null}
            </div>
            <InboundOutcomeNotice log={log} supabaseId={supabaseId} />
            <div className="flex min-w-0 flex-col gap-2">
              <p className="text-sm font-semibold">Payload da requisição</p>
              {log.requestPayload === null || log.requestPayload === undefined ? (
                <p className="text-sm text-muted-foreground">Sem dados de requisição.</p>
              ) : (
                <pre className="max-h-[320px] max-w-full overflow-auto rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed">
                  {formatPayload(log.requestPayload)}
                </pre>
              )}
            </div>
            {log.errorMessage ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{log.errorMessage}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function InboundOutcomeNotice({ log, supabaseId }: { log: TeamWebhookLogItem; supabaseId?: string }) {
  const outcome = readInboundLogOutcome(log.responsePayload)
  if (!outcome) return null
  const leadHref =
    supabaseId && outcome.leadCode ? `/${supabaseId}/crm?leadCode=${encodeURIComponent(outcome.leadCode)}` : null

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3" data-testid="inbound-log-outcome">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">{outcome.label}</p>
        {outcome.needsReschedule ? (
          <Badge variant="destructive" className="gap-1">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            Remarcar urgente
          </Badge>
        ) : null}
        {outcome.replay ? <Badge variant="outline">Reenvio da mesma chave</Badge> : null}
      </div>
      <p className="text-sm text-muted-foreground">{outcome.description}</p>
      <p className="break-all font-mono text-xs text-muted-foreground">
        {outcome.resultCode}
        {outcome.eventId ? ` · ${outcome.eventId}` : ""}
      </p>
      {leadHref ? (
        <Link
          href={leadHref}
          className="inline-flex min-h-11 w-fit items-center gap-1 text-sm underline underline-offset-4"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          Abrir lead no CRM
        </Link>
      ) : null}
    </div>
  )
}
