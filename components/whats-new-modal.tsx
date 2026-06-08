"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart3, Briefcase, Calculator } from "lucide-react"
import { useTeamContext } from "@/app/context/TeamContext"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const WHATS_NEW_VERSION = "v1"

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
  icon: React.ComponentType<{ className?: string }>
}

const WHATS_NEW_ITEMS: WhatsNewItem[] = [
  {
    id: "wallet",
    title: "Carteira",
    description:
      "Agora ficou mais fácil acompanhar sua carteira com uma visão clara dos clientes e oportunidades para priorizar melhor suas ações.",
    roles: ["manager", "backoffice"],
    icon: Briefcase,
  },
  {
    id: "performance",
    title: "Performance",
    description:
      "Acompanhe resultados com mais clareza por meio de métricas de desempenho para identificar gargalos e agir mais rápido.",
    roles: ["manager", "backoffice"],
    icon: BarChart3,
  },
  {
    id: "plan-simulator",
    title: "Simulador de Planos",
    description:
      "Faça simulações de planos de forma prática e rápida para apoiar suas conversas comerciais com mais confiança.",
    roles: ["manager", "backoffice", "operator"],
    icon: Calculator,
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
                    {item.roles.includes("operator") ? (
                      <Badge variant="secondary">Para todos</Badge>
                    ) : (
                      <Badge variant="secondary">Managers e backoffices</Badge>
                    )}
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
