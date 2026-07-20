"use client"

import { useState } from "react"
import { AlertTriangle, Eye } from "lucide-react"
import { toast } from "sonner"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CampaignAnalyticsService } from "../../services/CampaignAnalyticsService"
import { DispatchEmailPreviewDialog } from "./DispatchEmailPreviewDialog"
import { DispatchStatusBadge } from "./DispatchStatusBadge"
import type { AnalyticsData, DispatchPreviewData } from "./AnalyticsTypes"
import { cn } from "@/lib/utils"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"

const analyticsService = new CampaignAnalyticsService()

type DispatchAccordionTableProps = {
  campaignId: string
  data: AnalyticsData | null
  loading: boolean
}

function MetricCell({
  label,
  value,
  valueClassName,
  showWarning,
}: {
  label: string
  value: string | number
  valueClassName?: string
  showWarning?: boolean
}) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={cn("flex items-center gap-1 font-medium", valueClassName)}>
        {showWarning ? (
          <AlertTriangle className="size-3.5 shrink-0 text-destructive" aria-hidden />
        ) : null}
        <span>{value}</span>
      </p>
    </div>
  )
}

export function DispatchAccordionTable({
  campaignId,
  data,
  loading,
}: DispatchAccordionTableProps) {
  const { tz } = useTimezone()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<DispatchPreviewData | null>(null)
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null)

  async function handlePreview(dispatchId: string) {
    if (loadingPreviewId) return
    setLoadingPreviewId(dispatchId)
    try {
      const preview = await analyticsService.getDispatchPreview(campaignId, dispatchId)
      setPreviewData(preview)
      setPreviewOpen(true)
    } catch (err) {
      console.error("[DispatchAccordionTable] preview error", err)
      toast.error("Erro ao carregar prévia do e-mail")
    } finally {
      setLoadingPreviewId(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  const dispatches = data?.dispatches ?? []

  if (dispatches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Disparos da campanha</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhum disparo registrado no período selecionado.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Disparos da campanha</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {dispatches.map((dispatch) => {
              const audienceLabel = dispatch.radarSegmentSlug
                ? `Segmento CDP: ${dispatch.radarSegmentSlug}`
                : dispatch.contactListName ?? "Lista não informada"
              const highBounceRate = dispatch.rates.bounceRate > 4

              return (
                <AccordionItem key={dispatch.id} value={dispatch.id}>
                  <AccordionTrigger className="text-sm hover:no-underline">
                    <div className="flex flex-wrap items-center gap-2 text-left">
                      <span className="font-medium">Disparo #{dispatch.dispatchNumber}</span>
                      <DispatchStatusBadge status={dispatch.status} />
                      <Badge variant="outline">
                        Versão {dispatch.templateVersionNumber}.0
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatIntimezone(new Date(dispatch.dispatchedAt), "dd/MM/yyyy HH:mm", tz)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-4 pb-2">
                      {dispatch.status === "failed" && dispatch.errorMessage ? (
                        <Alert variant="destructive">
                          <AlertTriangle data-icon="inline-start" />
                          <AlertTitle>Falha no disparo</AlertTitle>
                          <AlertDescription>{dispatch.errorMessage}</AlertDescription>
                        </Alert>
                      ) : null}
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <p>
                          <span className="text-muted-foreground">Template: </span>
                          {dispatch.templateName}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Assunto: </span>
                          {dispatch.templateSubject}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Audiência: </span>
                          {audienceLabel}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Destinatários: </span>
                          {dispatch.totalRecipients.toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                          <p className="col-span-full text-xs font-medium text-muted-foreground">
                            Entrega
                          </p>
                          <MetricCell label="Enviados" value={dispatch.totalSent} />
                          <MetricCell label="Entregues" value={dispatch.totalDelivered} />
                          <MetricCell label="Bounces" value={dispatch.totalBounced} />
                          <MetricCell
                            label="Taxa de bounce"
                            value={`${dispatch.rates.bounceRate.toFixed(1)}%`}
                            valueClassName={highBounceRate ? "text-destructive" : undefined}
                            showWarning={highBounceRate}
                          />
                          <MetricCell label="Reclamações" value={dispatch.totalComplained} />
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                          <p className="col-span-full text-xs font-medium text-muted-foreground">
                            Engajamento
                          </p>
                          <MetricCell label="Abertos" value={dispatch.totalOpened} />
                          <MetricCell label="Cliques" value={dispatch.totalClicked} />
                          <MetricCell
                            label="Taxa de cliques"
                            value={`${dispatch.rates.clickRate.toFixed(1)}%`}
                          />
                        </div>
                      </div>
                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={loadingPreviewId === dispatch.id}
                          onClick={() => void handlePreview(dispatch.id)}
                        >
                          <Eye data-icon="inline-start" />
                          {loadingPreviewId === dispatch.id
                            ? "Carregando..."
                            : "Ver prévia do e-mail"}
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </CardContent>
      </Card>

      <DispatchEmailPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={previewData}
      />
    </>
  )
}
