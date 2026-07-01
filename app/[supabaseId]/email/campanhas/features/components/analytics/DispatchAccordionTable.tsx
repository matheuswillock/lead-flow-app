"use client"

import { useState } from "react"
import { Eye } from "lucide-react"
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
import { CampaignAnalyticsService } from "../../services/CampaignAnalyticsService"
import { DispatchEmailPreviewDialog } from "./DispatchEmailPreviewDialog"
import type { AnalyticsData, DispatchPreviewData } from "./AnalyticsTypes"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"

const analyticsService = new CampaignAnalyticsService()

type DispatchAccordionTableProps = {
  campaignId: string
  data: AnalyticsData | null
  loading: boolean
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
              const audienceLabel = dispatch.cdpSegmentSlug
                ? `Segmento CDP: ${dispatch.cdpSegmentSlug}`
                : dispatch.contactListName ?? "Lista não informada"

              return (
                <AccordionItem key={dispatch.id} value={dispatch.id}>
                  <AccordionTrigger className="text-sm hover:no-underline">
                    <div className="flex flex-wrap items-center gap-2 text-left">
                      <span className="font-medium">Disparo #{dispatch.dispatchNumber}</span>
                      <Badge variant="outline">
                        Versão {dispatch.templateVersionNumber}.0
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatIntimezone(dispatch.dispatchedAt, "dd/MM/yyyy HH:mm", tz)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-3 pb-2">
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
                      <div className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-5">
                        <div>
                          <p className="text-muted-foreground">Enviados</p>
                          <p className="font-medium">{dispatch.totalSent}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Entregues</p>
                          <p className="font-medium">{dispatch.totalDelivered}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Abertos</p>
                          <p className="font-medium">{dispatch.totalOpened}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cliques</p>
                          <p className="font-medium">{dispatch.totalClicked}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Bounces</p>
                          <p className="font-medium">{dispatch.totalBounced}</p>
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
