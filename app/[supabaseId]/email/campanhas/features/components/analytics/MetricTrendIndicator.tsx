"use client"

import { Minus, TrendingDown, TrendingUp } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { MetricDelta } from "./AnalyticsTypes"

type MetricTrendIndicatorProps = {
  delta?: MetricDelta | null
  /** Quando true, mostra Δ em pontos percentuais (pp). */
  isRate?: boolean
  /**
   * Quando true, inverte a polaridade de severidade: alta é ruim (destructive)
   * e queda é melhoria (primary). Usar em bounce, reclamação, falha, atraso,
   * descadastro e supressão.
   */
  inverse?: boolean
  className?: string
}

export function MetricTrendIndicator({
  delta,
  isRate = false,
  inverse = false,
  className,
}: MetricTrendIndicatorProps) {
  if (!delta) return null

  const Icon =
    delta.direction === "up" ? TrendingUp : delta.direction === "down" ? TrendingDown : Minus

  const upClass = inverse ? "text-destructive" : "text-primary"
  const downClass = inverse ? "text-primary" : "text-destructive"

  const colorClass =
    delta.direction === "up"
      ? upClass
      : delta.direction === "down"
        ? downClass
        : "text-muted-foreground"

  const absLabel = isRate
    ? `${delta.absolute > 0 ? "+" : ""}${delta.absolute.toFixed(1)} pp`
    : `${delta.absolute > 0 ? "+" : ""}${delta.absolute.toLocaleString("pt-BR")}`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-xs font-medium",
            colorClass,
            className,
          )}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden />
          <span>{absLabel}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">vs período anterior</TooltipContent>
    </Tooltip>
  )
}
