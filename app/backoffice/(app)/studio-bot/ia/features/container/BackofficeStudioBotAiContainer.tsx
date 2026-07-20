"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useBackofficeStudioBotAiService } from "../context/BackofficeStudioBotAiContext"
import type { BethaniaAiConfiguration, BethaniaAiOverview } from "../context/BackofficeStudioBotAiTypes"

export function BackofficeStudioBotAiContainer() {
  const service = useBackofficeStudioBotAiService()
  const [overview, setOverview] = useState<BethaniaAiOverview | null>(null)
  const [configuration, setConfiguration] = useState<BethaniaAiConfiguration | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const inFlightRef = useRef(false)
  const lastKeyRef = useRef<string | null>(null)

  const load = useEffectEvent(async () => {
    const key = "ai-overview"
    if (inFlightRef.current || lastKeyRef.current === key) return
    inFlightRef.current = true
    setIsLoading(true)
    try {
      const [nextOverview, nextConfiguration] = await Promise.all([
        service.getOverview(),
        service.getConfiguration(),
      ])
      setOverview(nextOverview)
      setConfiguration(nextConfiguration)
      lastKeyRef.current = key
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar IA")
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  })

  useEffect(() => {
    void load()
  }, [load])

  const handleToggleEnabled = async (enabled: boolean) => {
    if (isSaving) return
    setIsSaving(true)
    try {
      const output = await service.patchConfiguration({ enabled })
      if (!output.isValid || !output.result) {
        toast.error(output.errorMessages[0] ?? "Não foi possível atualizar")
        return
      }
      setConfiguration(output.result)
      lastKeyRef.current = null
      await load()
      toast.success(enabled ? "IA habilitada" : "IA desabilitada (kill switch)")
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestProvider = async () => {
    if (isTesting) return
    setIsTesting(true)
    try {
      const output = await service.testProvider()
      if (!output.isValid) {
        toast.error(output.errorMessages[0] ?? "Falha no teste")
        return
      }
      toast.success(output.successMessages[0] ?? "Teste sintético concluído")
      lastKeyRef.current = null
      await load()
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Bethânia · IA</h1>
        <p className="text-sm text-muted-foreground">
          Telemetria e controle operacional da Fase 0 — sem tráfego real de WhatsApp.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Status</CardTitle>
              <CardDescription>
                {overview?.message ?? "Kill switch e métricas sintéticas."}
              </CardDescription>
            </div>
            <Badge variant={overview?.aiActive ? "default" : "secondary"}>
              {overview?.aiActive ? "Ativa" : "IA não ativada"}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Interações</p>
              <p className="text-2xl font-semibold tabular-nums">
                {overview?.metrics.interactions ?? 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sucessos</p>
              <p className="text-2xl font-semibold tabular-nums">
                {overview?.metrics.successes ?? 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Falhas</p>
              <p className="text-2xl font-semibold tabular-nums">
                {overview?.metrics.failures ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="flex flex-col gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Modelo</CardTitle>
              <CardDescription>
                Primário: {overview?.configuration.primaryModel ?? "—"} · Fallback:{" "}
                {overview?.configuration.fallbackModel ?? "—"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Shadow mode: {overview?.configuration.shadowMode ? "ligado" : "desligado"} · Rollout:{" "}
                {overview?.configuration.rolloutPercentage ?? 0}%
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="config" className="flex flex-col gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kill switch</CardTitle>
              <CardDescription>
                `enabled=false` impede qualquer chamada de rede (exceto teste forçado MASTER).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={configuration?.enabled ?? false}
                  disabled={isSaving || !configuration}
                  onCheckedChange={(checked) => void handleToggleEnabled(checked)}
                />
                <span className="text-sm">
                  {configuration?.enabled ? "IA habilitada" : "IA desabilitada"}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={isTesting}
                onClick={() => void handleTestProvider()}
              >
                {isTesting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                Testar provider (sintético)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
