"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertTriangle, Settings } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE } from "@/lib/email/campaign-dispatch-guards"

type TrackingDegradedAlertProps = {
  warnings?: string[] | null
}

export function TrackingDegradedAlert({ warnings }: TrackingDegradedAlertProps) {
  const params = useParams<{ supabaseId?: string }>()
  const supabaseId = typeof params.supabaseId === "string" ? params.supabaseId : null

  if (!warnings?.length) return null

  return (
    <Alert className="border-semantic-warning/30 bg-semantic-warning-surface text-foreground">
      <AlertTriangle data-icon="inline-start" className="text-semantic-warning" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <AlertTitle>Habilite as métricas de tracking</AlertTitle>
          <AlertDescription>{RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE}</AlertDescription>
        </div>
        {supabaseId ? (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={`/${supabaseId}/email/configuracoes`}>
              <Settings data-icon="inline-start" />
              Ir para Configurações
            </Link>
          </Button>
        ) : null}
      </div>
    </Alert>
  )
}
