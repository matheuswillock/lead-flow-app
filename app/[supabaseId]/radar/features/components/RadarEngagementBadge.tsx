"use client"

import { Flame, Snowflake, Thermometer, ThermometerSnowflake, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { EngagementBand } from "@/lib/radar/engagement-score"

const BAND_CONFIG: Record<
  EngagementBand,
  { label: string; className: string; icon: LucideIcon }
> = {
  hot: {
    label: "Quente",
    className:
      "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger",
    icon: Flame,
  },
  warm: {
    label: "Morno",
    className:
      "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning",
    icon: Thermometer,
  },
  lukewarm: {
    label: "Morno-frio",
    className: "border-border bg-secondary text-secondary-foreground",
    icon: ThermometerSnowflake,
  },
  cold: {
    label: "Frio",
    className:
      "border-semantic-info-border bg-semantic-info-surface text-semantic-info",
    icon: Snowflake,
  },
}

export function radarEngagementBandLabel(band: string | null | undefined): string {
  if (!band || !(band in BAND_CONFIG)) return "—"
  return BAND_CONFIG[band as EngagementBand].label
}

type RadarEngagementBadgeProps = {
  band: string | null | undefined
  className?: string
  showIcon?: boolean
}

export function RadarEngagementBadge({
  band,
  className,
  showIcon = true,
}: RadarEngagementBadgeProps) {
  if (!band || !(band in BAND_CONFIG)) {
    return (
      <Badge variant="outline" className={cn("w-fit shrink-0 text-xs text-muted-foreground", className)}>
        —
      </Badge>
    )
  }

  const cfg = BAND_CONFIG[band as EngagementBand]
  const Icon = cfg.icon

  return (
    <Badge variant="outline" className={cn("w-fit shrink-0 gap-1 text-xs", cfg.className, className)}>
      {showIcon ? <Icon data-icon="inline-start" /> : null}
      {cfg.label}
    </Badge>
  )
}
