"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { API_CLIENT_BASE } from "@/lib/route-map"
import type { LeadRadarEngagement } from "@/app/[supabaseId]/radar/features/context/RadarTypes"
import { RadarEngagementBadge } from "@/app/[supabaseId]/radar/features/components/RadarEngagementBadge"

type LeadRadarTemperatureCardProps = {
  leadId: string
  supabaseId: string
  teamId: string
  enabled?: boolean
}

export function useLeadRadarEngagement(
  leadId: string,
  supabaseId: string,
  teamId: string,
  enabled = true
) {
  const [engagement, setEngagement] = useState<LeadRadarEngagement | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const inFlightRef = useRef(false)
  const lastKeyRef = useRef<string | null>(null)

  const fetchEngagement = useCallback(async () => {
    const key = `${teamId}:${leadId}`
    if (inFlightRef.current || lastKeyRef.current === key) return

    inFlightRef.current = true
    setIsLoading(true)

    try {
      const res = await fetch(
        `${API_CLIENT_BASE}/radar/profiles/by-lead/${encodeURIComponent(leadId)}/engagement`,
        {
          cache: "no-store",
          headers: {
            "x-supabase-user-id": supabaseId,
            "x-team-id": teamId,
          },
        }
      )
      if (!res.ok) return
      const json = (await res.json()) as {
        isValid?: boolean
        result?: LeadRadarEngagement | { notFound: true }
      }
      if (!json?.isValid || !json.result) return

      if ("notFound" in json.result && json.result.notFound) {
        setNotFound(true)
        setEngagement(null)
      } else {
        setNotFound(false)
        setEngagement(json.result as LeadRadarEngagement)
      }
      lastKeyRef.current = key
    } catch {
      // silencioso — a seção simplesmente não aparece
    } finally {
      setIsLoading(false)
      inFlightRef.current = false
    }
  }, [leadId, supabaseId, teamId])

  useEffect(() => {
    if (!enabled) {
      setEngagement(null)
      setNotFound(false)
      setIsLoading(false)
      lastKeyRef.current = null
      return
    }
    lastKeyRef.current = null
    void fetchEngagement()
  }, [enabled, fetchEngagement])

  return { engagement, notFound, isLoading }
}

export function LeadRadarTemperatureCard({
  leadId,
  supabaseId,
  teamId,
  enabled = true,
}: LeadRadarTemperatureCardProps) {
  const { engagement, notFound, isLoading } = useLeadRadarEngagement(
    leadId,
    supabaseId,
    teamId,
    enabled
  )

  if (!enabled) return null
  if (isLoading) {
    return (
      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border/60 p-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-24" />
      </div>
    )
  }
  if (notFound || !engagement) return null

  const tooltipLines =
    engagement.topEvents.length > 0
      ? engagement.topEvents.map(
          (event) => `${event.eventType} (${event.contribution > 0 ? "+" : ""}${event.contribution})`
        )
      : ["Sem eventos recentes na janela de engajamento."]

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border/60 p-3">
      <p className="text-xs font-medium text-muted-foreground">Temperatura Radar</p>
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-default">
              <RadarEngagementBadge band={engagement.band} />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <ul className="flex flex-col gap-1 text-xs">
              {tooltipLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
        <span className="text-sm font-medium tabular-nums">
          {engagement.score}
          <span className="text-muted-foreground">/100</span>
        </span>
      </div>
      <Button asChild size="sm" variant="outline" className="w-fit">
        <Link href={`/${supabaseId}/radar?perfil=${encodeURIComponent(engagement.profileId)}`}>
          Ver no Radar
          <ArrowRight data-icon="inline-end" />
        </Link>
      </Button>
    </div>
  )
}
