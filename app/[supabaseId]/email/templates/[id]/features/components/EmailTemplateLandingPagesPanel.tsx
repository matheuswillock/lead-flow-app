"use client"

import { useEffect, useState } from "react"
import { Copy, LayoutTemplate } from "lucide-react"
import { useParams } from "next/navigation"
import { useTeamContext } from "@/app/context/TeamContext"
import { API_CLIENT_BASE } from "@/lib/route-map"
import { buildLandingPageLinkEmailSnippet } from "@/lib/email/landing-page-link-embed"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

type Landing = { id: string; publicId: string; name: string; status: string }

export function EmailTemplateLandingPagesPanel({ embedded = false }: { embedded?: boolean }) {
  const params = useParams<{ supabaseId: string }>()
  const { activeTeamId } = useTeamContext()
  const [landings, setLandings] = useState<Landing[]>([])
  const [hostname, setHostname] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!activeTeamId) return
    setLoading(true)
    const headers = { "x-supabase-user-id": params.supabaseId, "x-team-id": activeTeamId }
    void Promise.all([
      fetch(`${API_CLIENT_BASE}/teams/${activeTeamId}/landing-pages`, { headers }).then((response) => response.json()),
      fetch(`${API_CLIENT_BASE}/teams/${activeTeamId}/landing-pages/domain`, { headers }).then((response) => response.json()),
    ]).then(([landingsOutput, domainOutput]) => {
      setLandings(Array.isArray(landingsOutput.result) ? landingsOutput.result.filter((landing: Landing) => landing.status === "published") : [])
      setHostname(domainOutput.result?.landingDomain?.status === "verified" ? domainOutput.result.landingDomain.hostname : null)
    }).catch(() => toast.error("Não foi possível carregar as landing pages")).finally(() => setLoading(false))
  }, [activeTeamId, params.supabaseId])

  const selected = landings.find((landing) => landing.id === selectedId) ?? null
  const landingUrl = selected && hostname ? `https://${hostname}/conversation/${selected.publicId}` : ""
  const copy = async (value: string, label: string) => { await navigator.clipboard.writeText(value); toast.success(`${label} copiado`) }

  return <div className={embedded ? "flex flex-col gap-4" : "flex flex-col gap-4 p-4"}>
    <div><h3 className="text-sm font-semibold">Landing pages de cotação</h3><p className="text-xs text-muted-foreground">Escolha uma landing publicada para inserir no e-mail.</p></div>
    {loading ? <Skeleton className="h-24 w-full" /> : landings.length === 0 ? <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center"><LayoutTemplate className="size-8 text-muted-foreground" /><p className="text-xs text-muted-foreground">Nenhuma landing publicada.</p></div> : <FieldGroup><Field><FieldLabel>Landing page</FieldLabel><Select value={selectedId} onValueChange={setSelectedId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{landings.map((landing) => <SelectItem key={landing.id} value={landing.id}>{landing.name}</SelectItem>)}</SelectContent></Select></Field>{selected && landingUrl ? <div className="grid gap-3 rounded-lg border bg-card p-3"><p className="break-all text-xs text-muted-foreground">{landingUrl}</p><div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => void copy(landingUrl, "Link")}><Copy data-icon="inline-start" />Copiar link</Button><Button type="button" variant="ghost" size="sm" onClick={() => void copy(buildLandingPageLinkEmailSnippet({ landingName: selected.name, landingUrl }), "HTML")}><Copy data-icon="inline-start" />Copiar HTML</Button></div></div> : null}</FieldGroup>}
  </div>
}
