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

const STATUS_CONFIG: Record<EmailLogStatus, { label: string; className: string }> = {
  queued: { label: "Na fila", className: "border bg-transparent text-muted-foreground" },
  sent: { label: "Enviado", className: "border border-blue-200 bg-blue-50 text-blue-700" },
  delivered: { label: "Entregue", className: "bg-blue-500/15 text-blue-700 border-0" },
  opened: { label: "Aberto", className: "bg-purple-500/15 text-purple-700 border-0" },
  clicked: { label: "Clicado", className: "bg-emerald-500/15 text-emerald-700 border-0" },
  bounced: { label: "Bounce", className: "bg-destructive/15 text-destructive border-0" },
  complained: { label: "Reclamação", className: "bg-orange-500/15 text-orange-700 border-0" },
  failed: { label: "Falhou", className: "bg-destructive/15 text-destructive border-0" },
}

function LogStatusBadge({ status }: { status: EmailLogStatus }) {
  const cfg = STATUS_CONFIG[status]
  return <Badge className={cfg.className}>{cfg.label}</Badge>
}

function LogRow({ log }: { log: EmailLog }) {
  const { handleOpenDetail } = useHistoricoContext()

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
        {log.sentAt ? new Date(log.sentAt).toLocaleString("pt-BR") : "—"}
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
