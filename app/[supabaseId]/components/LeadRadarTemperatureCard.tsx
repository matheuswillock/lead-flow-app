"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowRight, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { API_CLIENT_BASE } from "@/lib/route-map"
import { cn } from "@/lib/utils"
import type { EngagementBand } from "@/lib/radar/engagement-score"
import type {
  FormSubmissionScoreBreakdown,
  LeadRadarEngagement,
} from "@/app/[supabaseId]/radar/features/context/RadarTypes"
import { RadarEngagementBadge } from "@/app/[supabaseId]/radar/features/components/RadarEngagementBadge"

const BAND_CARD_TINT: Record<EngagementBand, string> = {
  hot: "border-semantic-danger-border bg-semantic-danger-surface",
  warm: "border-semantic-warning-border bg-semantic-warning-surface",
  lukewarm: "border-border/60 bg-muted/40",
  cold: "border-semantic-info-border bg-semantic-info-surface",
}

function bandCardTint(band: string | null | undefined): string {
  if (!band || !(band in BAND_CARD_TINT)) return "border-border/60 bg-muted/40"
  return BAND_CARD_TINT[band as EngagementBand]
}

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
  const [formSubmissions, setFormSubmissions] = useState<FormSubmissionScoreBreakdown[]>([])
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
        result?:
          | (LeadRadarEngagement & { formSubmissions?: FormSubmissionScoreBreakdown[] })
          | { notFound: true; formSubmissions?: FormSubmissionScoreBreakdown[] }
      }
      if (!json?.isValid || !json.result) return

      const submissions = json.result.formSubmissions ?? []
      setFormSubmissions(submissions)

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
      setFormSubmissions([])
      setNotFound(false)
      setIsLoading(false)
      lastKeyRef.current = null
      return
    }
    lastKeyRef.current = null
    void fetchEngagement()
  }, [enabled, fetchEngagement])

  return { engagement, formSubmissions, notFound, isLoading }
}

function FormScoreBreakdownSection({
  submissions,
}: {
  submissions: FormSubmissionScoreBreakdown[]
}) {
  if (submissions.length === 0) return null

  return (
    <div className="mt-2 flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">Score de formulários</p>
      <div className="activity-scrollbar flex max-h-56 flex-col gap-2 overflow-y-auto">
      {submissions.map((submission) => (
        <Collapsible key={submission.submissionId} className="rounded-md border border-border/60">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-2 text-left text-sm">
            <span className="min-w-0 truncate font-medium">{submission.formTitle}</span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              {submission.scorePercent}%
              {submission.scoreBandLabel ? ` · ${submission.scoreBandLabel}` : ""}
              <ChevronDown className="size-3.5" />
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-2 border-t border-border/60 p-2">
            <p className="text-xs text-muted-foreground">
              {format(new Date(submission.submittedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              {" · "}
              Peso final: {submission.finalWeight} (base {submission.baseWeight} ×{" "}
              {submission.temperatureMultiplier})
            </p>
            {submission.answers.length > 0 ? (
              <ul className="flex flex-col gap-1.5 text-xs">
                {submission.answers.map((answer, index) => (
                  <li
                    key={`${submission.submissionId}-${index}`}
                    className="flex flex-col gap-0.5 rounded-sm bg-muted/40 px-2 py-1.5"
                  >
                    <span className="font-medium">{answer.questionLabel}</span>
                    <span className="text-muted-foreground">
                      {answer.chosenOptionLabel}
                      {" · "}
                      {answer.chosenOptionPolarity === "negative" ? "Negativo" : "Positivo"}
                      {" · "}
                      peso {answer.chosenOptionScore}
                      {" · "}
                      contribuição {answer.contribution > 0 ? "+" : ""}
                      {answer.contribution}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Sem respostas de escolha registradas.</p>
            )}
          </CollapsibleContent>
        </Collapsible>
      ))}
      </div>
    </div>
  )
}

export function LeadRadarTemperatureCard({
  leadId,
  supabaseId,
  teamId,
  enabled = true,
}: LeadRadarTemperatureCardProps) {
  const { engagement, formSubmissions, notFound, isLoading } = useLeadRadarEngagement(
    leadId,
    supabaseId,
    teamId,
    enabled
  )

  if (!enabled) return null
  if (isLoading) {
    return (
      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/40 p-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-24" />
      </div>
    )
  }
  if ((notFound || !engagement) && formSubmissions.length === 0) return null

  const tooltipLines =
    engagement && engagement.topEvents.length > 0
      ? engagement.topEvents.map(
          (event) => `${event.eventType} (${event.contribution > 0 ? "+" : ""}${event.contribution})`
        )
      : ["Sem eventos recentes na janela de engajamento."]

  return (
    <div
      className={cn(
        "mt-3 flex flex-col gap-2 rounded-lg border p-3 transition-colors",
        bandCardTint(engagement?.band)
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">Temperatura Radar</p>
      {engagement ? (
        <>
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
        </>
      ) : null}
      <FormScoreBreakdownSection submissions={formSubmissions} />
    </div>
  )
}
