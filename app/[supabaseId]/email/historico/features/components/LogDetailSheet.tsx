"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { useHistoricoContext } from "../context/HistoricoContext"
import { EventsTimeline } from "./EventsTimeline"

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

function Timestamp({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{new Date(value).toLocaleString("pt-BR")}</span>
    </div>
  )
}

export function LogDetailSheet() {
  const { selectedLogId, selectedLog, loadingDetail, handleCloseDetail } = useHistoricoContext()

  return (
    <Sheet open={Boolean(selectedLogId)} onOpenChange={(open) => { if (!open) handleCloseDetail() }}>
      <SheetContent className="w-full max-w-md overflow-y-auto">
        {loadingDetail || !selectedLog ? (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <>
            <SheetHeader className="space-y-1">
              <SheetTitle className="font-mono text-base">{selectedLog.recipientEmail}</SheetTitle>
              {selectedLog.recipientName && (
                <SheetDescription>{selectedLog.recipientName}</SheetDescription>
              )}
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assunto</p>
                <p className="text-sm">{selectedLog.subject}</p>
              </div>

              {selectedLog.campaign && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campanha</p>
                  <p className="text-sm">{selectedLog.campaign.name}</p>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
                <Badge variant="outline">{STATUS_LABELS[selectedLog.status] ?? selectedLog.status}</Badge>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timestamps</p>
                <Timestamp label="Enviado em" value={selectedLog.sentAt} />
                <Timestamp label="Entregue em" value={selectedLog.deliveredAt} />
                <Timestamp label="Aberto em" value={selectedLog.openedAt} />
                <Timestamp label="Clicado em" value={selectedLog.clickedAt} />
                <Timestamp label="Bounce em" value={selectedLog.bouncedAt} />
                <Timestamp label="Reclamação em" value={selectedLog.complainedAt} />
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linha do Tempo</p>
                <EventsTimeline events={selectedLog.events} />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
