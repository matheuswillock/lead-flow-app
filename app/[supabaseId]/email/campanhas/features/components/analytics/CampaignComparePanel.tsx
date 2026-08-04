"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useCampanhasContext } from "../../context/CampanhasContext"
import type { Campaign } from "../../context/CampanhasTypes"
import { CampaignAnalyticsService } from "../../services/CampaignAnalyticsService"
import type {
  AnalyticsPeriod,
  CompareCampaignsData,
  MetricDelta,
} from "./AnalyticsTypes"
import { MetricTrendIndicator } from "./MetricTrendIndicator"
import { useTimezone } from "@/app/context/TimezoneContext"

const service = new CampaignAnalyticsService()
const MAX_COMPARE = 3

const COMPARABLE_STATUSES = new Set([
  "sent",
  "partially_sent",
  "sending",
  "scheduled",
  "failed",
])

type CampaignComparePanelProps = {
  period: AnalyticsPeriod
  preselectedCampaignId?: string
}

function RateCell({
  label,
  value,
  delta,
  isRate,
}: {
  label: string
  value: string
  delta?: MetricDelta | null
  isRate?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold">{value}</span>
        <MetricTrendIndicator delta={delta} isRate={isRate} />
      </div>
    </div>
  )
}

export function CampaignComparePanel({
  period,
  preselectedCampaignId,
}: CampaignComparePanelProps) {
  const { campaigns } = useCampanhasContext()
  const { tz: timezone } = useTimezone()
  const [selectedIds, setSelectedIds] = useState<string[]>(
    preselectedCampaignId ? [preselectedCampaignId] : [],
  )
  const [data, setData] = useState<CompareCampaignsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  const lastKeyRef = useRef<string | null>(null)

  const selectableCampaigns = useMemo(
    () =>
      campaigns.filter(
        (campaign: Campaign) =>
          !campaign.parentCampaignId && COMPARABLE_STATUSES.has(campaign.status),
      ),
    [campaigns],
  )

  useEffect(() => {
    if (!preselectedCampaignId) return
    setSelectedIds((prev) =>
      prev.includes(preselectedCampaignId) ? prev : [preselectedCampaignId, ...prev].slice(0, MAX_COMPARE),
    )
  }, [preselectedCampaignId])

  useEffect(() => {
    if (selectedIds.length === 0) {
      setData(null)
      setError(null)
      return
    }

    const requestKey = `${period}|${selectedIds.slice().sort().join(",")}`
    if (inFlightRef.current) return
    if (lastKeyRef.current === requestKey && data) return

    let cancelled = false
    inFlightRef.current = true
    setLoading(true)
    setError(null)

    void service
      .compareCampaigns(selectedIds, period, timezone)
      .then((result) => {
        if (cancelled) return
        setData(result)
        lastKeyRef.current = requestKey
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Erro ao comparar")
      })
      .finally(() => {
        inFlightRef.current = false
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [period, selectedIds, timezone])

  function toggleCampaign(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id)
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, id]
    })
    lastKeyRef.current = null
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Comparar campanhas</p>
        <p className="text-xs text-muted-foreground">
          Selecione até {MAX_COMPARE} campanhas para comparar métricas lado a lado.
        </p>
        <div className="flex flex-wrap gap-2">
          {selectableCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma campanha elegível para comparação.</p>
          ) : (
            selectableCampaigns.map((campaign) => {
              const selected = selectedIds.includes(campaign.id)
              const disabled = !selected && selectedIds.length >= MAX_COMPARE
              return (
                <Button
                  key={campaign.id}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  disabled={disabled}
                  onClick={() => toggleCampaign(campaign.id)}
                  className={cn(disabled && "opacity-50")}
                >
                  {campaign.name}
                </Button>
              )
            })
          )}
        </div>
        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selectedIds.map((id) => {
              const campaign = selectableCampaigns.find((item) => item.id === id)
              return (
                <Badge key={id} variant="secondary">
                  {campaign?.name ?? id}
                </Badge>
              )
            })}
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: selectedIds.length || 1 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="mb-3 h-5 w-32" />
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.campaigns.map((campaign) => (
            <Card key={campaign.campaignId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{campaign.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <RateCell
                  label="Entregabilidade"
                  value={`${campaign.rates.deliverabilityRate.toFixed(1)}%`}
                  delta={campaign.deltas?.rates.deliverabilityRate}
                  isRate
                />
                <RateCell
                  label="Abertura"
                  value={`${campaign.rates.openRate.toFixed(1)}%`}
                  delta={campaign.deltas?.rates.openRate}
                  isRate
                />
                <RateCell
                  label="Cliques"
                  value={`${campaign.rates.clickRate.toFixed(1)}%`}
                  delta={campaign.deltas?.rates.clickRate}
                  isRate
                />
                <RateCell
                  label="Bounce"
                  value={`${campaign.rates.bounceRate.toFixed(1)}%`}
                  delta={campaign.deltas?.rates.bounceRate}
                  isRate
                />
                <Separator />
                <RateCell
                  label="Formulário"
                  value={(campaign.totals.formCompletions ?? 0).toLocaleString("pt-BR")}
                  delta={campaign.deltas?.totals.formCompletions}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}
