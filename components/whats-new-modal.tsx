"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarOff } from "lucide-react"
import { useTeamContext } from "@/app/context/TeamContext"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const WHATS_NEW_VERSION = "v2"

type TeamRole = "manager" | "backoffice" | "operator"

interface WhatsNewModalProps {
  supabaseId: string
  enabled?: boolean
}

interface WhatsNewItem {
  id: string
  title: string
  description: string
  roles: TeamRole[]
  audienceLabel: string
  icon: React.ComponentType<{ className?: string }>
}

const WHATS_NEW_ITEMS: WhatsNewItem[] = [
  {
    id: "calendar-availability",
    title: "Disponibilidade no calendário",
    description:
      "Marque períodos em que você estará ocupado para não receber novos agendamentos. Defina data de início e fim, escolha dia inteiro ou horário, configure recorrência e, se quiser, ocupe também a agenda do Google Calendar.",
    roles: ["manager", "backoffice", "operator"],
    audienceLabel: "Closers e managers",
    icon: CalendarOff,
  },
]

function getSeenStorageKey(supabaseId: string) {
  return `whats-new:seen:${WHATS_NEW_VERSION}:${supabaseId}`
}

export function WhatsNewModal({ supabaseId, enabled = true }: WhatsNewModalProps) {
  const { activeRole } = useTeamContext()
  const [open, setOpen] = useState(false)

  const visibleItems = useMemo(() => {
    if (!activeRole) return []
    return WHATS_NEW_ITEMS.filter((item) => item.roles.includes(activeRole))
  }, [activeRole])

  useEffect(() => {
    if (!enabled) return
    if (!activeRole) return
    if (visibleItems.length === 0) return
    if (typeof window === "undefined") return

    const key = getSeenStorageKey(supabaseId)
    const hasSeen = window.localStorage.getItem(key) === "true"
    if (!hasSeen) {
      setOpen(true)
    }
  }, [enabled, activeRole, supabaseId, visibleItems.length])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && typeof window !== "undefined") {
      window.localStorage.setItem(getSeenStorageKey(supabaseId), "true")
    }
    setOpen(nextOpen)
  }

  if (!enabled || !activeRole || visibleItems.length === 0) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] flex flex-col sm:max-w-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="pr-6">
          <DialogTitle>🚀 Novidades no Corretor Studio</DialogTitle>
          <DialogDescription>
            Tem recurso novo no ar para acelerar sua rotina. Dê uma olhada no que já está disponível para você.
          </DialogDescription>
        </DialogHeader>
        <div className="dialog-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {visibleItems.map((item) => (
            <article key={item.id} className="rounded-lg border border-border bg-card p-4 text-card-foreground">
              <div className="flex items-start gap-3">
                <div className="rounded-md border border-border bg-muted/40 p-2">
                  <item.icon className="size-4 text-primary" />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <Badge variant="secondary">{item.audienceLabel}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
