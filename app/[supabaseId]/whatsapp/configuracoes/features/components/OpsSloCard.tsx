"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Activity, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useTeamContext } from "@/app/context/TeamContext"
import { isManagerLikeRole } from "@/lib/roles"
import { whatsAppSettingsService } from "../services/WhatsAppSettingsService"
import type { WhatsAppOpsMetrics } from "../context/WhatsAppSettingsTypes"

function MetricTile({ label, value, tone }: { label: string; value: number; tone?: "warn" | "ok" }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {tone === "warn" && value > 0 ? (
          <Badge variant="destructive">Atenção</Badge>
        ) : (
          <Badge variant="secondary">OK</Badge>
        )}
      </div>
    </div>
  )
}

export function OpsSloCard() {
  const { supabaseId } = useParams<{ supabaseId: string }>()
  const { activeTeamId, isTeamMaster, activeTeam } = useTeamContext()
  const canManageInfrastructure = isTeamMaster || isManagerLikeRole(activeTeam?.role)
  const [metrics, setMetrics] = useState<WhatsAppOpsMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRequeueing, setIsRequeueing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  const lastSuccessKeyRef = useRef<string | null>(null)

  const load = useCallback(async (force = false) => {
    if (!activeTeamId || !supabaseId) return
    const key = `ops:${activeTeamId}`
    if (inFlightRef.current) return
    if (!force && lastSuccessKeyRef.current === key) return
    inFlightRef.current = true
    setIsLoading(true)
    setError(null)
    try {
      const result = await whatsAppSettingsService.fetchOpsMetrics(activeTeamId, supabaseId)
      setMetrics(result)
      lastSuccessKeyRef.current = key
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar métricas")
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  }, [activeTeamId, supabaseId])

  useEffect(() => {
    lastSuccessKeyRef.current = null
    void load()
  }, [load])

  const handleRequeueDeadLetter = useCallback(async () => {
    if (!activeTeamId || !supabaseId || isRequeueing) return
    setIsRequeueing(true)
    try {
      const result = await whatsAppSettingsService.requeueDeadLetterEvents(activeTeamId, supabaseId)
      toast.success(`${result.requeuedCount} evento(s) reenfileirado(s) com sucesso`)
      lastSuccessKeyRef.current = null
      await load(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível reenfileirar os eventos")
    } finally {
      setIsRequeueing(false)
    }
  }, [activeTeamId, supabaseId, isRequeueing, load])

  if (!activeTeamId) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4" aria-hidden />
            Saúde operacional (SLO)
          </CardTitle>
          <CardDescription>
            Contagens agregadas sem conteúdo nem telefone. Dead-letter exige requeue autorizado.
            Monitorar por 7 dias após o deploy para calibrar alertas.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={() => void load(true)}
        >
          <RefreshCw data-icon="inline-start" />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading && !metrics ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {metrics ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                <span className="text-xs text-muted-foreground">Dead-letter</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold tabular-nums">{metrics.deadLetterCount}</span>
                  {metrics.deadLetterCount > 0 ? (
                    <Badge variant="destructive">Atenção</Badge>
                  ) : (
                    <Badge variant="secondary">OK</Badge>
                  )}
                </div>
                {canManageInfrastructure ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={metrics.deadLetterCount === 0 || isRequeueing}
                      >
                        {isRequeueing ? "Reenfileirando..." : "Reenfileirar dead-letter"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reenfileirar eventos dead-letter</AlertDialogTitle>
                        <AlertDialogDescription>
                          {metrics.deadLetterCount} evento(s) em dead-letter serão movidos de volta para
                          processamento. Confirme apenas se os eventos ainda são válidos para reprocessar.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleRequeueDeadLetter()}>
                          Reenfileirar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </div>
              <MetricTile label="Webhook pendente" value={metrics.pendingWebhookCount} tone="warn" />
              <MetricTile label="Envio UNKNOWN" value={metrics.unknownOutboundCount} tone="warn" />
              <MetricTile label="Mídia FAILED" value={metrics.failedMediaCount} tone="warn" />
              <MetricTile
                label="Ações PENDING"
                value={metrics.pendingActionCommandCount}
                tone="warn"
              />
              <MetricTile
                label="Ações UNKNOWN"
                value={metrics.unknownActionCommandCount}
                tone="warn"
              />
            </div>
            <p className="text-xs text-muted-foreground">{metrics.requeueHint}</p>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
