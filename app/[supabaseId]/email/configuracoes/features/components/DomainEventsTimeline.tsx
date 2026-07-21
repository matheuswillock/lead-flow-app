"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CircleCheck, Globe, ListChecks, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DomainEvent, DomainEventType, ResendDomainStatus } from "../context/EmailSettingsTypes"

type TimelineStep = {
  type: DomainEventType
  label: string
  icon: LucideIcon
}

const STEPS: TimelineStep[] = [
  { type: "domain_added", label: "Domínio adicionado", icon: Globe },
  { type: "dns_verified", label: "DNS verificado", icon: ListChecks },
  { type: "domain_verified", label: "Domínio verificado", icon: CircleCheck },
]

function stepState(
  stepType: DomainEventType,
  events: DomainEvent[],
  domainStatus: ResendDomainStatus | null
): "done" | "active" | "pending" | "error" {
  const event = events.find((item) => item.type === stepType)
  if (event) return "done"

  if (stepType === "domain_verified" && domainStatus === "verified") return "done"
  if (domainStatus === "failed" || domainStatus === "temporary_failure") {
    if (stepType === "domain_verified") return "error"
  }

  const stepIndex = STEPS.findIndex((step) => step.type === stepType)
  const previousDone = STEPS.slice(0, stepIndex).every(
    (step) => events.some((item) => item.type === step.type) ||
      (step.type === "domain_verified" && domainStatus === "verified")
  )

  if (previousDone && stepIndex === events.length) return "active"
  return "pending"
}

type DomainEventsTimelineProps = {
  events: DomainEvent[]
  domainStatus: ResendDomainStatus | null
}

export function DomainEventsTimeline({ events, domainStatus }: DomainEventsTimelineProps) {
  const isVerified = domainStatus === "verified" || events.some((e) => e.type === "domain_verified")

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Eventos do domínio
      </p>

      {isVerified ? (
        <div className="rounded-2xl border border-semantic-success/30 bg-semantic-success/10 px-4 py-3 text-sm">
          <span className="font-semibold text-semantic-success">Domínio verificado:</span>{" "}
          <span className="text-muted-foreground">Seu domínio está pronto para enviar e-mails.</span>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-[color:var(--surface-1)] p-5">
        <div className="flex min-w-[520px] items-start justify-between gap-2">
          {STEPS.map((step, index) => {
            const event = events.find((item) => item.type === step.type)
            const state = stepState(step.type, events, domainStatus)
            const Icon = step.icon

            return (
              <div key={step.type} className="flex flex-1 flex-col items-center gap-3">
                <div className="flex w-full items-center">
                  {index > 0 ? (
                    <div
                      className={cn(
                        "h-px flex-1",
                        state === "pending" ? "bg-border" : "bg-semantic-success/50"
                      )}
                    />
                  ) : (
                    <div className="flex-1" />
                  )}
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                      state === "done" && "border-semantic-success/30 bg-semantic-success/10 text-semantic-success",
                      state === "active" && "border-semantic-warning/30 bg-semantic-warning-surface text-semantic-warning",
                      state === "pending" && "border-border bg-background text-muted-foreground",
                      state === "error" && "border-destructive/30 bg-destructive/10 text-destructive"
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  {index < STEPS.length - 1 ? (
                    <div
                      className={cn(
                        "h-px flex-1",
                        stepState(STEPS[index + 1]!.type, events, domainStatus) === "pending"
                          ? "bg-border"
                          : "bg-semantic-success/50"
                      )}
                    />
                  ) : (
                    <div className="flex-1" />
                  )}
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-lg text-xs",
                    state === "done" && "border-semantic-success/30 text-semantic-success",
                    state === "active" && "border-semantic-warning/30 text-semantic-warning",
                    state === "pending" && "text-muted-foreground",
                    state === "error" && "border-destructive/30 text-destructive"
                  )}
                >
                  {step.label}
                </Badge>

                {event ? (
                  <p className="text-center text-xs text-muted-foreground">
                    {format(new Date(event.occurredAt), "dd MMM, h:mm a", { locale: ptBR })}
                  </p>
                ) : (
                  <p className="text-center text-xs text-muted-foreground">—</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
