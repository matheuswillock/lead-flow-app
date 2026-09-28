"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Clipboard, Clock, Globe2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { API_CLIENT_BASE } from "@/lib/route-map"

type StudioDomain = { hostname: string; status: "pending" | "verified" | "failed" }
type DnsRecord = { record: string; name: string; value: string; status: string }

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const output = (await response.json()) as { isValid?: boolean; errorMessages?: string[]; result?: T }
  if (!response.ok || output.isValid === false) throw new Error(output.errorMessages?.join(", ") ?? "Não foi possível carregar o domínio studio")
  return output.result as T
}

export function StudioDomainCard() {
  const [domain, setDomain] = useState<StudioDomain | null>(null)
  const [records, setRecords] = useState<DnsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const result = await readJson<{ studioDomain: StudioDomain | null; records?: DnsRecord[] }>(`${API_CLIENT_BASE}/email/settings/studio-domain/records`)
      setDomain(result.studioDomain)
      setRecords(result.records ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar o domínio studio")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function verify() {
    setVerifying(true)
    try {
      await readJson(`${API_CLIENT_BASE}/email/settings/studio-domain`, { method: "PATCH" })
      toast.success("Verificação do domínio solicitada")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível verificar o domínio")
    } finally {
      setVerifying(false)
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value)
    toast.success("Registro copiado")
  }

  if (loading) return <Skeleton className="h-56 w-full rounded-xl" />

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Globe2 className="size-4 text-primary" />Domínio studio</CardTitle>
        <CardDescription>Um único subdomínio para formulários e páginas de conversão.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!domain ? <p className="text-sm text-muted-foreground">Verifique o domínio de envio para gerar automaticamente o subdomínio studio.</p> : <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
            <span className="font-mono text-sm">https://{domain.hostname}</span>
            <Badge variant="outline" className="gap-1">{domain.status === "verified" ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}{domain.status === "verified" ? "Verificado" : "Aguardando DNS"}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Adicione o CNAME abaixo no provedor DNS do domínio de envio. Este registro aponta o subdomínio studio para a aplicação pública.</p>
          {records.length > 0 ? <div className="flex flex-col gap-2 rounded-lg border p-3 text-xs"><div className="grid grid-cols-[80px_minmax(0,1fr)_auto] gap-3 font-medium text-muted-foreground"><span>Tipo</span><span>Nome → valor</span><span /></div>{records.map((record) => <div className="grid grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-3" key={`${record.record}-${record.name}`}><span>{record.record}</span><span className="break-all font-mono">{record.name} → {record.value}</span><Button type="button" variant="ghost" size="icon" aria-label={`Copiar registro ${record.name}`} onClick={() => void copy(`${record.name} ${record.value}`)}><Clipboard /></Button></div>)}</div> : null}
          {domain.status !== "verified" ? <Button type="button" variant="outline" onClick={() => void verify()} disabled={verifying}><RefreshCw data-icon="inline-start" />{verifying ? "Verificando…" : "Verificar DNS"}</Button> : null}
        </>}
      </CardContent>
    </Card>
  )
}
