"use client"

import { useEffect, useRef, useState } from "react"
import { BarChart3, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { backofficeStudioEmailService } from "../../services/BackofficeStudioEmailService"
import type { StudioEmailAnalytics } from "../../services/IBackofficeStudioEmailService"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  masterId: string
  teamId: string
  campaignId?: string
  campaignName?: string
}

function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string
  value: string
  subtitle: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

export function BackofficeCampaignAnalyticsDialog({
  open,
  onOpenChange,
  masterId,
  teamId,
  campaignId,
  campaignName,
}: Props) {
  const [data, setData] = useState<StudioEmailAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const fetchingRef = useRef(false)

  async function fetchAnalytics(silent = false) {
    if (!masterId || !teamId || fetchingRef.current) return
    fetchingRef.current = true
    if (silent) setRefreshing(true)
    else setLoading(true)

    try {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 30)
      const result = await backofficeStudioEmailService.getAnalytics(masterId, teamId, {
        from: from.toISOString(),
        to: to.toISOString(),
        campaignId,
      })
      setData(result)
    } catch (error) {
      console.error("[BackofficeCampaignAnalyticsDialog] fetch error", error)
      if (!silent) toast.error("Erro ao carregar métricas")
    } finally {
      setLoading(false)
      setRefreshing(false)
      fetchingRef.current = false
    }
  }

  useEffect(() => {
    if (!open) return
    setData(null)
    void fetchAnalytics()
  }, [open, masterId, teamId, campaignId])

  const title = campaignName ? `Métricas — ${campaignName}` : "Métricas de E-mail"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 data-icon="inline-start" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchAnalytics(true)}
              disabled={refreshing || loading}
            >
              <RefreshCw data-icon="inline-start" className={cn(refreshing && "animate-spin")} />
              Atualizar
            </Button>
          </div>

          {loading || !data ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="mb-2 h-4 w-24" />
                    <Skeleton className="h-9 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <MetricCard
                title="Entregabilidade"
                value={`${data.rates.deliverabilityRate.toFixed(1)}%`}
                subtitle={`${data.totals.delivered.toLocaleString("pt-BR")} entregues de ${data.totals.sent.toLocaleString("pt-BR")}`}
              />
              <MetricCard
                title="Taxa de Abertura"
                value={`${data.rates.openRate.toFixed(1)}%`}
                subtitle={`${data.totals.opened.toLocaleString("pt-BR")} aberturas`}
              />
              <MetricCard
                title="Taxa de Clique"
                value={`${data.rates.clickRate.toFixed(1)}%`}
                subtitle={`${data.totals.clicked.toLocaleString("pt-BR")} cliques`}
              />
              <MetricCard
                title="Bounce"
                value={`${data.rates.bounceRate.toFixed(1)}%`}
                subtitle={`${data.totals.bounced.toLocaleString("pt-BR")} bounces`}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
