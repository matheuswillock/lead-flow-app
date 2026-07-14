"use client"

import { Check, Circle, Download, LockKeyhole, Mail, RefreshCw, TriangleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatIntimezone } from "@/lib/dates/formatters"
import { useTimezone } from "@/app/context/TimezoneContext"
import type { BackofficeActivationPipeline as ActivationPipeline } from "../context/BackofficeAllUsersTypes"

const stateLabel = { completed: "Concluído", current: "Em andamento", pending: "Pendente", blocked: "Bloqueado" } as const

export function BackofficeActivationPipeline({ pipeline, isActing, onResend, onDownload, onRetry }: { pipeline: ActivationPipeline; isActing: boolean; onResend: () => void; onDownload: () => void; onRetry: () => void }) {
  const { tz } = useTimezone()
  return <section aria-labelledby="activation-pipeline-title" className="flex flex-col gap-4">
    <div className="flex items-start justify-between gap-3"><div className="flex flex-col gap-1"><p id="activation-pipeline-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jornada de ativação</p>{pipeline.protocol ? <p className="text-xs text-muted-foreground">Protocolo {pipeline.protocol}</p> : null}</div>{pipeline.hasProcessingFailure ? <Badge variant="outline" className="border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger"><TriangleAlert />Falha na evidência</Badge> : null}</div>
    <ol className="flex flex-col" aria-label="Etapas da ativação">{pipeline.steps.map((step, index) => {
      const Icon = step.state === "completed" ? Check : step.state === "blocked" ? LockKeyhole : Circle
      return <li key={step.key} aria-current={step.state === "current" ? "step" : undefined} className="grid min-h-16 grid-cols-[32px_1fr] gap-3">
        <div className="flex flex-col items-center"><span className={cn("flex size-8 items-center justify-center rounded-full border", step.state === "completed" && "border-semantic-success-border bg-semantic-success-surface text-semantic-success", step.state === "current" && "border-semantic-info-border bg-semantic-info-surface text-semantic-info", step.state === "pending" && "border-border bg-muted text-muted-foreground", step.state === "blocked" && "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger")}><Icon className="size-4" aria-hidden /></span>{index < pipeline.steps.length - 1 ? <span className="min-h-8 w-px flex-1 bg-border" aria-hidden /> : null}</div>
        <div className="flex items-start justify-between gap-3 pb-4"><div className="flex flex-col gap-1"><span className="text-sm font-medium">{step.label}</span><span className="text-xs text-muted-foreground">{step.occurredAt ? formatIntimezone(new Date(step.occurredAt), "dd/MM/yyyy HH:mm", tz) : stateLabel[step.state]}</span></div><Badge variant="outline">{stateLabel[step.state]}</Badge></div>
      </li>
    })}</ol>
    <div className="flex flex-wrap gap-2">{!pipeline.protocol ? <Button type="button" variant="outline" onClick={onResend} disabled={isActing}><Mail data-icon="inline-start" />Reenviar link de aceite</Button> : null}{pipeline.evidenceAvailable ? <Button type="button" variant="outline" onClick={onDownload} disabled={isActing}><Download data-icon="inline-start" />Baixar comprovante</Button> : null}{pipeline.hasProcessingFailure ? <Button type="button" variant="outline" onClick={onRetry} disabled={isActing}><RefreshCw data-icon="inline-start" />Reprocessar evidência</Button> : null}</div>
  </section>
}
