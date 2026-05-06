"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useHistoricoContext } from "../context/HistoricoContext"
import type { EmailLog, EmailLogStatus } from "../context/HistoricoTypes"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"

const STATUS_CONFIG: Record<EmailLogStatus, { label: string; className: string }> = {
  queued: { label: "Na fila", className: "border bg-transparent text-muted-foreground" },
  sent: { label: "Enviado", className: "border-semantic-info-border bg-semantic-info-surface text-semantic-info" },
  delivered: { label: "Entregue", className: "border-semantic-info-border bg-semantic-info-surface text-semantic-info" },
  opened: { label: "Aberto", className: "border-semantic-new-border bg-semantic-new-surface text-semantic-new" },
  clicked: { label: "Clicado", className: "border-semantic-success-border bg-semantic-success-surface text-semantic-success" },
  bounced: { label: "Bounce", className: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger" },
  complained: { label: "Reclamação", className: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning" },
  failed: { label: "Falhou", className: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger" },
}

function LogStatusBadge({ status }: { status: EmailLogStatus }) {
  const cfg = STATUS_CONFIG[status]
  return <Badge className={cfg.className}>{cfg.label}</Badge>
}

function LogRow({ log }: { log: EmailLog }) {
  const { handleOpenDetail } = useHistoricoContext()
  const { tz } = useTimezone()

  return (
    <TableRow>
      <TableCell>
        <div className="font-mono text-sm">{log.recipientEmail}</div>
        {log.recipientName && (
          <div className="text-xs text-muted-foreground">{log.recipientName}</div>
        )}
      </TableCell>
      <TableCell className="max-w-48 truncate text-sm">{log.subject}</TableCell>
      <TableCell><LogStatusBadge status={log.status} /></TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {log.campaign?.name ?? "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {log.sentAt ? formatIntimezone(new Date(log.sentAt), "dd/MM/yyyy HH:mm", tz) : "—"}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => void handleOpenDetail(log.id)}
        >
          Ver detalhes
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function LogsTable() {
  const { logs, total, page, totalPages, loading, handlePageChange } = useHistoricoContext()

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destinatário</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum email encontrado para os filtros selecionados
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => <LogRow key={log.id} log={log} />)
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString("pt-BR")} email(s)</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => handlePageChange(page - 1)}
          >
            Anterior
          </Button>
          <span>{page} / {totalPages || 1}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => handlePageChange(page + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  )
}
