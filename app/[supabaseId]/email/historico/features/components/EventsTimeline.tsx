"use client"

import type { EmailEvent } from "../context/HistoricoTypes"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"

const EVENT_LABELS: Record<string, string> = {
  sent: "Enviado",
  delivered: "Entregue",
  opened: "Aberto",
  clicked: "Clicado",
  bounced: "Bounce",
  complained: "Reclamação",
  delivery_delayed: "Atraso na entrega",
  unsubscribed: "Descadastrado",
  failed: "Falhou",
}

interface EventsTimelineProps {
  events: EmailEvent[]
}

export function EventsTimeline({ events }: EventsTimelineProps) {
  const { tz } = useTimezone()

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum evento registrado</p>
    )
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  )

  return (
    <ol>
      {sorted.map((event, index) => (
        <li
          key={event.id}
          className={`flex gap-3 ${index < sorted.length - 1 ? "pb-4" : ""}`}
        >
          <div className="flex w-5 shrink-0 flex-col items-center">
            <span className="z-10 flex size-5 shrink-0 rounded-full border-2 border-primary bg-background" />
            {index < sorted.length - 1 ? (
              <span className="w-px flex-1 bg-border" aria-hidden />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium">
              {EVENT_LABELS[event.type] ?? event.type}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatIntimezone(new Date(event.occurredAt), "dd/MM/yyyy HH:mm", tz)}
            </p>
            {event.metadata?.link && (
              <p className="mt-0.5 text-xs text-muted-foreground break-all">
                Link: {event.metadata.link}
              </p>
            )}
            {event.metadata?.bounceMessage && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {event.metadata.bounceMessage}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
