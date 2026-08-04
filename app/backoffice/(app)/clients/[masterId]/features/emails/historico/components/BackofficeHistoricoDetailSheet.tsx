"use client"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { EventsTimeline } from "@/app/[supabaseId]/email/historico/features/components/EventsTimeline"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"
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

function Timestamp({ label, value, tz }: { label: string; value: string | null | undefined; tz: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{formatIntimezone(new Date(value), "dd/MM/yyyy HH:mm", tz)}</span>
    </div>
  )
}

type Props = Pick<
  BackofficeHistoricoViewState,
  "selectedLogId" | "selectedLog" | "loadingDetail" | "handleCloseDetail"
>

export function BackofficeHistoricoDetailSheet(props: Props) {
  const { selectedLogId, selectedLog, loadingDetail, handleCloseDetail } = props
  const { tz } = useTimezone()

  return (
    <Sheet
      open={Boolean(selectedLogId)}
      onOpenChange={(open) => {
        if (!open) handleCloseDetail()
      }}
    >
      <SheetContent className="w-full max-w-md overflow-y-auto">
        {loadingDetail || !selectedLog ? (
          <div className="flex flex-col gap-4 pt-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="gap-1">
              <SheetTitle className="font-mono text-base">{selectedLog.recipientEmail}</SheetTitle>
              {selectedLog.recipientName ? (
                <SheetDescription>{selectedLog.recipientName}</SheetDescription>
              ) : null}
            </SheetHeader>

            <div className="mt-4 flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assunto</p>
                <p className="text-sm">{selectedLog.subject ?? "—"}</p>
              </div>

              {selectedLog.campaign ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campanha</p>
                  <p className="text-sm">{selectedLog.campaign.name}</p>
                </div>
              ) : null}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
                <Badge variant="outline">{STATUS_LABELS[selectedLog.status] ?? selectedLog.status}</Badge>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timestamps</p>
                <Timestamp label="Enviado em" value={selectedLog.sentAt} tz={tz} />
                <Timestamp label="Entregue em" value={selectedLog.deliveredAt} tz={tz} />
                <Timestamp label="Aberto em" value={selectedLog.openedAt} tz={tz} />
                <Timestamp label="Clicado em" value={selectedLog.clickedAt} tz={tz} />
                <Timestamp label="Bounce em" value={selectedLog.bouncedAt} tz={tz} />
                <Timestamp label="Reclamação em" value={selectedLog.complainedAt} tz={tz} />
              </div>

              <Separator />

              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Linha do tempo
                </p>
                <EventsTimeline
                  events={(selectedLog.events ?? []).map((event) => ({
                    id: event.id,
                    type: event.type as "sent",
                    occurredAt: event.occurredAt,
                    metadata: event.metadata,
                  }))}
                />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
