"use client"

import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type TrackingDegradedAlertProps = {
  warnings?: string[] | null
}

export function TrackingDegradedAlert({ warnings }: TrackingDegradedAlertProps) {
  if (!warnings?.length) return null

  return (
    <Alert className="border-semantic-warning/30 bg-semantic-warning-surface text-foreground">
      <AlertTriangle data-icon="inline-start" className="text-semantic-warning" />
      <AlertTitle>Métricas de tracking limitadas</AlertTitle>
      <AlertDescription>{warnings.join(" ")}</AlertDescription>
    </Alert>
  )
}
