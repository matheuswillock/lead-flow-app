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
    <ol className="relative space-y-4 border-l border-border pl-5">
      {sorted.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[1.4rem] flex h-5 w-5 items-center justify-center rounded-full bg-background border-2 border-primary" />
          <div>
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
