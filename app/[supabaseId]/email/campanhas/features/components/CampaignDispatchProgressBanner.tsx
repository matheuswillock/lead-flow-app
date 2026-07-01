"use client"

import { useEffect, useState } from "react"
import { Loader2, Send } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useCampanhasContext } from "../context/CampanhasContext"

export function CampaignDispatchProgressBanner() {
  const { sendingId, campaigns } = useCampanhasContext()
  const [progressValue, setProgressValue] = useState(12)

  const sendingCampaign = sendingId
    ? campaigns.find((campaign) => campaign.id === sendingId)
    : null

  useEffect(() => {
    if (!sendingId) {
      setProgressValue(12)
      return
    }

    const intervalId = window.setInterval(() => {
      setProgressValue((current) => {
        if (current >= 88) return 18
        return current + 7
      })
    }, 700)

    return () => window.clearInterval(intervalId)
  }, [sendingId])

  if (!sendingId || !sendingCampaign) return null

  const recipients = sendingCampaign.totalRecipients.toLocaleString("pt-BR")

  return (
    <Card className="border-semantic-warning-border bg-semantic-warning-surface">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-semantic-warning/15">
            <Loader2 className="size-4 animate-spin text-semantic-warning" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Send className="size-4 shrink-0 text-semantic-warning" />
              <p className="font-medium text-foreground">
                Disparando &quot;{sendingCampaign.name}&quot;
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Enviando para {recipients} destinatário(s). Não feche esta página até concluir.
            </p>
          </div>
        </div>
        <Progress value={progressValue} className="h-2" />
      </CardContent>
    </Card>
  )
}
