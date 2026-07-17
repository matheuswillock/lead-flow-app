"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime } from "@/lib/dates"
import { DEFAULT_TZ } from "@/lib/dates/DEFAULT_TZ"
import { useBackofficeEmailCampaigns } from "../context/BackofficeEmailCampaignsHook"
import type { BackofficeEmailCampaignDispatchItem } from "../context/BackofficeEmailCampaignsTypes"

interface Props {
  campaignId: string | null
  campaignName: string
  onOpenChange(open: boolean): void
}

export function EmailCampaignDispatchHistoryPanel({ campaignId, campaignName, onOpenChange }: Props) {
  const { listDispatches } = useBackofficeEmailCampaigns()
  const [dispatches, setDispatches] = useState<BackofficeEmailCampaignDispatchItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!campaignId) return
    setIsLoading(true)
    listDispatches(campaignId)
      .then(setDispatches)
      .finally(() => setIsLoading(false))
  }, [campaignId, listDispatches])

  return (
    <Dialog open={Boolean(campaignId)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de disparos — {campaignName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Carregando histórico...
            </div>
          ) : dispatches.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum disparo registrado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Enviados</TableHead>
                  <TableHead className="text-right">Entregues</TableHead>
                  <TableHead className="text-right">Abertos</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatches.map((dispatch) => (
                  <TableRow key={dispatch.id}>
                    <TableCell>{dispatch.dispatchNumber}</TableCell>
                    <TableCell>{formatDateTime(dispatch.createdAt, DEFAULT_TZ)}</TableCell>
                    <TableCell>
                      <Badge variant={dispatch.status === "failed" ? "destructive" : "secondary"}>
                        {dispatch.status === "completed"
                          ? "Concluído"
                          : dispatch.status === "failed"
                            ? "Falhou"
                            : "Enviando"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{dispatch.totalSent}</TableCell>
                    <TableCell className="text-right">{dispatch.totalDelivered}</TableCell>
                    <TableCell className="text-right">{dispatch.totalOpened}</TableCell>
                    <TableCell className="text-right">{dispatch.totalClicked}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
