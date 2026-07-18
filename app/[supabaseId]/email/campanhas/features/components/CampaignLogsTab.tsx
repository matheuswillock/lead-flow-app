"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout"
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter"
import { CampanhasService } from "../services/CampanhasService"
import type {
  CampaignEmailLog,
  CampaignLogDetail,
  CampaignLogStatus,
} from "../context/CampanhasTypes"
import { useTeamContext } from "@/app/context/TeamContext"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"
import { useParams } from "next/navigation"

const service = new CampanhasService()

const STATUS_CONFIG: Record<CampaignLogStatus, { label: string; className: string }> = {
  queued: { label: "Na fila", className: "border bg-transparent text-muted-foreground" },
  sent: { label: "Enviado", className: "border-semantic-info-border bg-semantic-info-surface text-semantic-info" },
  delivered: { label: "Entregue", className: "border-semantic-info-border bg-semantic-info-surface text-semantic-info" },
  opened: { label: "Aberto", className: "border-semantic-new-border bg-semantic-new-surface text-semantic-new" },
  clicked: { label: "Clicado", className: "border-semantic-success-border bg-semantic-success-surface text-semantic-success" },
  bounced: { label: "Bounce", className: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger" },
  complained: { label: "Reclamação", className: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning" },
  failed: { label: "Falhou", className: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger" },
}

const EVENT_LABELS: Record<string, string> = {
  sent: "Enviado",
  delivered: "Entregue",
  opened: "Aberto",
  clicked: "Clicado",
  bounced: "Bounce",
  complained: "Reclamação",
  delivery_delayed: "Atraso na entrega",
  unsubscribed: "Descadastrado",
  failed: "Falhou",
}

const STATUS_FILTER_OPTIONS = [
  { value: "queued", label: "Na fila" },
  { value: "sent", label: "Enviado" },
  { value: "delivered", label: "Entregue" },
  { value: "opened", label: "Aberto" },
  { value: "clicked", label: "Clicado" },
  { value: "bounced", label: "Bounce" },
  { value: "complained", label: "Reclamação" },
  { value: "failed", label: "Falhou" },
]

function getAudienceLabel(log: CampaignEmailLog): string {
  if (log.dispatch?.cdpSegmentSlug) return `Segmento CDP: ${log.dispatch.cdpSegmentSlug}`
  if (log.dispatch?.contactListName) return log.dispatch.contactListName
  return "—"
}

function statusKey(statuses: string[]): string {
  return [...statuses].sort().join(",")
}

type CampaignLogsTabProps = {
  campaignId: string
}

export function CampaignLogsTab({ campaignId }: CampaignLogsTabProps) {
  const params = useParams<{ supabaseId: string }>()
  const supabaseId = params.supabaseId
  const { activeTeamId } = useTeamContext()
  const { tz } = useTimezone()

  const [logs, setLogs] = useState<CampaignEmailLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [selectedLog, setSelectedLog] = useState<CampaignLogDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchingRef = useRef(false)
  const lastKeyRef = useRef("")
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [search])

  const fetchLogs = useCallback(async (nextPage: number, nextSearch: string, nextStatuses: string[]) => {
    if (!activeTeamId || !supabaseId) return
    const key = `${campaignId}|${nextPage}|${nextSearch}|${statusKey(nextStatuses)}|${activeTeamId}`
    if (fetchingRef.current || lastKeyRef.current === key) return
    fetchingRef.current = true
    setLoading(true)
    try {
      const result = await service.getCampaignLogs(supabaseId, activeTeamId, campaignId, {
        page: nextPage,
        pageSize: 20,
        search: nextSearch || undefined,
        status: nextStatuses.length > 0 ? nextStatuses : undefined,
      })
      setLogs(result.logs)
      setTotal(result.total)
      setPage(result.page)
      setTotalPages(result.totalPages)
      lastKeyRef.current = key
    } catch (err) {
      console.error("[CampaignLogsTab] fetchLogs error", err)
      toast.error("Erro ao carregar logs da campanha")
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [activeTeamId, campaignId, supabaseId])

  useEffect(() => {
    lastKeyRef.current = ""
    void fetchLogs(page, debouncedSearch, statusFilter)
  }, [fetchLogs, page, debouncedSearch, statusFilter])

  function handleStatusFilterChange(values: string[]) {
    setStatusFilter(values)
    setPage(1)
    lastKeyRef.current = ""
  }

  async function handleOpenDetail(logId: string) {
    if (!activeTeamId || !supabaseId || loadingDetail) return
    setLoadingDetail(true)
    try {
      const detail = await service.getCampaignLogDetail(supabaseId, activeTeamId, logId)
      setSelectedLog(detail)
    } catch (err) {
      console.error("[CampaignLogsTab] detail error", err)
      toast.error("Erro ao carregar detalhes do log")
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <LeadsFiltersLayout>
        <Input
          className="h-8 w-full max-w-xs text-sm"
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <LeadsMultiFilter
          title="Status"
          options={STATUS_FILTER_OPTIONS}
          selectedValues={statusFilter}
          onChange={handleStatusFilterChange}
        />
      </LeadsFiltersLayout>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destinatário</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Grupo de contato</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum log encontrado para esta campanha.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const statusCfg = STATUS_CONFIG[log.status]
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="font-mono text-sm">{log.recipientEmail}</div>
                      {log.recipientName ? (
                        <div className="text-xs text-muted-foreground">{log.recipientName}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-sm">{log.subject}</TableCell>
                    <TableCell>
                      <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getAudienceLabel(log)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.sentAt
                        ? formatIntimezone(new Date(log.sentAt), "dd/MM/yyyy HH:mm", tz)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={loadingDetail}
                        onClick={() => void handleOpenDetail(log.id)}
                      >
                        Ver detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString("pt-BR")} log(s)</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => {
              lastKeyRef.current = ""
              setPage((p) => Math.max(1, p - 1))
            }}
          >
            Anterior
          </Button>
          <span>
            {page} / {Math.max(1, totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => {
              lastKeyRef.current = ""
              setPage((p) => p + 1)
            }}
          >
            Próxima
          </Button>
        </div>
      </div>

      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => { if (!open) setSelectedLog(null) }}>
        <DialogContent className="max-h-[90vh] flex flex-col max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">
              {selectedLog?.recipientEmail ?? "Detalhes do log"}
            </DialogTitle>
            {selectedLog?.recipientName ? (
              <DialogDescription>{selectedLog.recipientName}</DialogDescription>
            ) : null}
          </DialogHeader>
          {selectedLog ? (
            <div className="overflow-y-auto flex-1 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assunto</p>
                <p className="text-sm">{selectedLog.subject}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grupo de contato</p>
                <p className="text-sm">{getAudienceLabel(selectedLog)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
                <Badge className={STATUS_CONFIG[selectedLog.status].className}>
                  {STATUS_CONFIG[selectedLog.status].label}
                </Badge>
              </div>
              <Separator />
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timestamps</p>
                {selectedLog.sentAt ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Enviado em</span>
                    <span>{formatIntimezone(new Date(selectedLog.sentAt), "dd/MM/yyyy HH:mm", tz)}</span>
                  </div>
                ) : null}
                {selectedLog.deliveredAt ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Entregue em</span>
                    <span>{formatIntimezone(new Date(selectedLog.deliveredAt), "dd/MM/yyyy HH:mm", tz)}</span>
                  </div>
                ) : null}
                {selectedLog.openedAt ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Aberto em</span>
                    <span>{formatIntimezone(new Date(selectedLog.openedAt), "dd/MM/yyyy HH:mm", tz)}</span>
                  </div>
                ) : null}
                {selectedLog.clickedAt ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Clicado em</span>
                    <span>{formatIntimezone(new Date(selectedLog.clickedAt), "dd/MM/yyyy HH:mm", tz)}</span>
                  </div>
                ) : null}
              </div>
              <Separator />
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linha do Tempo</p>
                {selectedLog.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum evento registrado</p>
                ) : (
                  selectedLog.events.map((event) => (
                    <div key={event.id} className="flex justify-between gap-2 text-sm">
                      <span>{EVENT_LABELS[event.type] ?? event.type}</span>
                      <span className="text-muted-foreground">
                        {formatIntimezone(new Date(event.occurredAt), "dd/MM/yyyy HH:mm", tz)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
