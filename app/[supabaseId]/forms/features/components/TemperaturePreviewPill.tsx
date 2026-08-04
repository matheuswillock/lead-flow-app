"use client"

import { Flame, Snowflake, Thermometer, ThermometerSun } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { EngagementBand } from "@/lib/radar/engagement-score"
import { TEMPERATURE_BAND_LABEL } from "@/lib/public-forms/temperature-preview"

const BAND_ICON = {
  hot: Flame,
  warm: ThermometerSun,
  lukewarm: Thermometer,
  cold: Snowflake,
} as const

const BAND_CLASS: Record<EngagementBand, string> = {
  hot: "text-destructive",
  warm: "text-foreground",
  lukewarm: "text-muted-foreground",
  cold: "text-muted-foreground",
}

export function TemperaturePreviewPill({ band }: { band: EngagementBand }) {
  const Icon = BAND_ICON[band]
  return (
    <Badge variant="outline" className={cn("w-fit gap-1 font-normal", BAND_CLASS[band])}>
      <Icon aria-hidden />
      Temperatura estimada: {TEMPERATURE_BAND_LABEL[band]}
    </Badge>
  )
}
