"use client"

import { Badge } from "@/components/ui/badge"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"

export function DomainDeliverabilityStatus() {
  const { settings } = useEmailSettingsContext()
  const limit = settings?.warmupLimit ?? 100
  const used = settings?.warmupUsed ?? 0
  const remaining = settings?.warmupRemaining ?? Math.max(0, limit - used)

  return <section className="grid gap-4 rounded-xl border bg-background p-4 md:grid-cols-[1fr_auto]" aria-label="Entrega e reputação do domínio">
    <div className="flex flex-col gap-2"><div className="flex flex-wrap gap-2"><Badge variant={settings?.domainTemperature === "stable" ? "outline" : "secondary"}>Temperatura: {settings?.domainTemperature === "stable" ? "estável" : "aquecendo"}</Badge><Badge variant={settings?.domainHealth === "paused" ? "destructive" : "outline"}>Saúde: {settings?.domainHealth === "healthy" ? "saudável" : settings?.domainHealth === "paused" ? "pausada" : "atenção"}</Badge><Badge variant={settings?.dmarcStatus === "aligned" ? "outline" : "secondary"}>DMARC: {settings?.dmarcStatus === "aligned" ? "alinhado" : settings?.dmarcStatus === "failed" ? "falhou" : settings?.dmarcStatus === "attention" ? "atenção" : "pendente"}</Badge></div><p className="text-sm text-muted-foreground">{settings?.warmupReason ?? "O limite cresce automaticamente quando volume e saúde permanecem dentro da política."}</p></div><div className="flex min-w-40 flex-col gap-1 md:text-right"><p className="text-sm font-medium">{used.toLocaleString("pt-BR")} de {limit.toLocaleString("pt-BR")}</p><p className="text-xs text-muted-foreground">{remaining.toLocaleString("pt-BR")} disponíveis hoje</p></div>
  </section>
}
