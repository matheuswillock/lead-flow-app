"use client"

import { useEffect, useState, type ReactNode } from "react"
import { AlertCircle, CheckCircle2, Clock, Copy, Globe2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { API_CLIENT_BASE } from "@/lib/route-map"
import { cn } from "@/lib/utils"

type StudioDomain = { hostname: string; status: "pending" | "verified" | "failed" }
type DnsRecord = { record: string; name: string; value: string; status: string }
type StudioDomainResponse = { studioDomain: StudioDomain | null; suggestedHostname?: string | null; records?: DnsRecord[] }

const DNS_STATUS_META: Record<string, { label: string; icon: ReactNode; className: string }> = {
  verified: {
    label: "Verificado",
    icon: <CheckCircle2 className="size-3" />,
    className: "border-semantic-success/30 bg-semantic-success/10 text-semantic-success",
  },
  failed: {
    label: "Falhou",
    icon: <AlertCircle className="size-3" />,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  pending: {
    label: "Pendente",
    icon: <Clock className="size-3" />,
    className: "border-semantic-warning/30 bg-semantic-warning-surface text-semantic-warning",
  },
  not_started: {
    label: "Não iniciado",
    icon: <Clock className="size-3" />,
    className: "border-border bg-background text-muted-foreground",
  },
}

function DnsStatusBadge({ status }: { status?: string }) {
  const meta = DNS_STATUS_META[status ?? ""] ?? DNS_STATUS_META.pending!

  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap rounded-lg", meta.className)}>
      {meta.icon}
      {meta.label}
    </Badge>
  )
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const output = (await response.json()) as { isValid?: boolean; errorMessages?: string[]; result?: T }
  if (!response.ok || output.isValid === false) throw new Error(output.errorMessages?.join(", ") ?? "Não foi possível carregar o domínio studio")
  return output.result as T
}

export function StudioDomainCard() {
  const [domain, setDomain] = useState<StudioDomain | null>(null)
  const [suggestedHostname, setSuggestedHostname] = useState<string | null>(null)
  const [records, setRecords] = useState<DnsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const result = await readJson<StudioDomainResponse>(`${API_CLIENT_BASE}/email/settings/studio-domain/records`)
      setDomain(result.studioDomain)
      setSuggestedHostname(result.suggestedHostname ?? null)
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

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copiado`)
    } catch {
      toast.error("Não foi possível copiar")
    }
  }

  if (loading) return <Skeleton className="h-56 w-full rounded-xl" />

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Globe2 className="size-4 text-primary" />Domínio studio</CardTitle>
        <CardDescription>Um único subdomínio para formulários e páginas de conversão.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!domain && !suggestedHostname ? <p className="text-sm text-muted-foreground">Conecte um domínio de envio para gerar automaticamente o subdomínio studio.</p> : <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
            <span className="font-mono text-sm">https://{domain?.hostname ?? suggestedHostname}</span>
            <DnsStatusBadge status={domain?.status} />
          </div>
          {!domain ? <p className="text-xs text-muted-foreground">O endereço foi calculado a partir do domínio de envio conectado. O registro será acompanhado automaticamente.</p> : null}
          <p className="text-xs text-muted-foreground">Estes são registros adicionais, separados de DKIM, SPF e tracking. Adicione-os no provedor DNS do domínio de envio para apontar o subdomínio studio para a aplicação pública.</p>
          {records.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-foreground">
                Domínio studio
              </p>
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/80">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Propósito</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>TTL</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={`${record.record}-${record.name}`}>
                        <TableCell className="text-xs font-medium">Studio</TableCell>
                        <TableCell className="font-mono text-xs">{record.record}</TableCell>
                        <TableCell>
                          <div className="flex max-w-xs items-start gap-2">
                            <span className="break-all font-mono text-xs text-foreground">{record.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 max-lg:size-11 shrink-0"
                              aria-label={`Copiar nome ${record.name}`}
                              onClick={() => void copy(record.name, "Nome")}
                            >
                              <Copy />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-xs items-start gap-2">
                            <span className="break-all font-mono text-xs text-foreground">{record.value}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 max-lg:size-11 shrink-0"
                              aria-label={`Copiar valor ${record.value}`}
                              onClick={() => void copy(record.value, "Valor")}
                            >
                              <Copy />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">—</TableCell>
                        <TableCell className="text-xs">Auto</TableCell>
                        <TableCell>
                          <DnsStatusBadge status={record.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
          {domain ? <>
          {domain.status !== "verified" ? <Button type="button" variant="outline" className="w-full" onClick={() => void verify()} disabled={verifying}><RefreshCw data-icon="inline-start" />{verifying ? "Verificando…" : "Verificar DNS"}</Button> : null}
          </> : null}
        </>}
      </CardContent>
    </Card>
  )
}
