"use client"

import { useEffect, useState } from "react"
import { Code2, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { API_CLIENT_BASE } from "@/lib/route-map"

type Tracking = { headScripts: string | null; bodyStartScripts: string | null; bodyEndScripts: string | null }

export function StudioTrackingCard() {
  const [tracking, setTracking] = useState<Tracking>({ headScripts: "", bodyStartScripts: "", bodyEndScripts: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`${API_CLIENT_BASE}/email/settings/studio-domain/records`)
      .then((response) => response.json())
      .then((output) => {
        const value = output.result?.studioDomain?.tracking as Tracking | undefined
        if (value) setTracking(value)
      })
      .catch(() => toast.error("Não foi possível carregar os códigos de rastreamento"))
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const response = await fetch(`${API_CLIENT_BASE}/email/settings/studio-domain`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tracking),
      })
      const output = await response.json()
      if (!response.ok || !output.isValid) throw new Error(output.errorMessages?.join(", ") ?? "Não foi possível salvar")
      toast.success("Códigos de rastreamento salvos")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card id="rastreamento">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Code2 className="size-4 text-primary" />Analytics e tráfego</CardTitle>
        <CardDescription>Adicione Meta Pixel, Google Analytics ou outros códigos às páginas públicas do domínio studio.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-xs text-muted-foreground">Use somente códigos fornecidos pelos seus provedores. Eles serão carregados em formulários e páginas de conversão publicados.</p>
        <div className="flex flex-col gap-2"><Label htmlFor="studio-head-scripts">Cabeçalho HTML</Label><Textarea id="studio-head-scripts" value={tracking.headScripts ?? ""} onChange={(event) => setTracking((current) => ({ ...current, headScripts: event.target.value }))} placeholder={'<script>...</script> ou <meta ... />'} disabled={loading} className="min-h-28 font-mono text-xs" /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="studio-body-start">Início do body</Label><Textarea id="studio-body-start" value={tracking.bodyStartScripts ?? ""} onChange={(event) => setTracking((current) => ({ ...current, bodyStartScripts: event.target.value }))} placeholder={'<noscript>...</noscript>'} disabled={loading} className="min-h-24 font-mono text-xs" /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="studio-body-end">Fim do body</Label><Textarea id="studio-body-end" value={tracking.bodyEndScripts ?? ""} onChange={(event) => setTracking((current) => ({ ...current, bodyEndScripts: event.target.value }))} placeholder={'<script async src="..."></script>'} disabled={loading} className="min-h-24 font-mono text-xs" /></div>
        <Button type="button" onClick={() => void save()} disabled={loading || saving} className="min-h-11 w-fit"><Save data-icon="inline-start" />{saving ? "Salvando..." : "Salvar códigos"}</Button>
      </CardContent>
    </Card>
  )
}
