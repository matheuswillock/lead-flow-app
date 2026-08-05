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
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"
import type { StudioEmailLog } from "../../services/IBackofficeStudioEmailService"
import type { BackofficeHistoricoViewState } from "../hooks/useBackofficeHistoricoTypes"

const STATUS_LABELS: Record<string, string> = {
  queued: "Na fila",
  sent: "Enviado",
  delivered: "Entregue",
  opened: "Aberto",
  clicked: "Clicado",
  bounced: "Bounce",
  complained: "Reclamação",
  failed: "Falhou",
}

type Props = Pick<
  BackofficeHistoricoViewState,
  "logs" | "total" | "page" | "totalPages" | "loading" | "handlePageChange" | "handleOpenDetail"
>

function LogRow({
  log,
  onOpen,
}: {
  log: StudioEmailLog
  onOpen: (id: string) => void
}) {
  const { tz } = useTimezone()

  return (
    <TableRow>
      <TableCell>
        <div className="font-mono text-sm">{log.recipientEmail}</div>
        {log.recipientName ? (
          <div className="text-xs text-muted-foreground">{log.recipientName}</div>
        ) : null}
      </TableCell>
      <TableCell className="max-w-48 truncate text-sm">{log.subject ?? "—"}</TableCell>
      <TableCell>
        <Badge variant="outline">{STATUS_LABELS[log.status] ?? log.status}</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {log.campaign?.name ?? "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {log.sentAt ? formatIntimezone(new Date(log.sentAt), "dd/MM/yyyy HH:mm", tz) : "—"}
      </TableCell>
      <TableCell>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => void onOpen(log.id)}
        >
          Ver detalhes
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function BackofficeHistoricoTable(props: Props) {
  const { logs, total, page, totalPages, loading, handlePageChange, handleOpenDetail } = props

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destinatário</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
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
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum e-mail encontrado para os filtros selecionados
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <LogRow key={log.id} log={log} onOpen={(id) => void handleOpenDetail(id)} />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString("pt-BR")} e-mail(s)</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => handlePageChange(page - 1)}
          >
            Anterior
          </Button>
          <span>{page} / {totalPages || 1}</span>
          <Button
            type="button"
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
