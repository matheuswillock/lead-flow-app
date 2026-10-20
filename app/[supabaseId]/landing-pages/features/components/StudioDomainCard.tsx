"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Clock, Copy, Globe2, Info, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { API_CLIENT_BASE } from "@/lib/route-map"
import { cn } from "@/lib/utils"

type StudioDomainStatus = "pending" | "verified" | "failed"
type DnsAuditStatus = "pending" | "verified" | "misconfigured" | "failed" | "inconclusive"

type StudioDomain = {
  hostname: string
  status: StudioDomainStatus
  dnsAuditStatus?: DnsAuditStatus | null
  dnsMisconfigured?: boolean | null
  dnsReasonCode?: string | null
  dnsReason?: string | null
  recommendedCNAME?: string | null
  lastDnsAuditAt?: string | null
  lastDnsAttemptAt?: string | null
}

type DnsRecord = {
  record: string
  type?: string
  name: string
  value: string
  priority?: number
  ttl?: string
  status: string
}

type StudioDomainResponse = {
  studioDomain: StudioDomain | null
  suggestedHostname?: string | null
  records?: DnsRecord[]
}

const DOMAIN_STATUS_META: Record<
  StudioDomainStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  verified: {
    label: "Verificado",
    icon: CheckCircle2,
    className: "border-semantic-success-border bg-semantic-success-surface text-semantic-success",
  },
  failed: {
    label: "Falhou",
    icon: AlertCircle,
    className: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger",
  },
  pending: {
    label: "Pendente",
    icon: Clock,
    className: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning",
  },
}

const RECORD_STATUS_LABELS: Record<string, string> = {
  verified: "Verificado",
  pending: "Pendente",
  failed: "Falhou",
  not_started: "Não iniciado",
}

function DnsStatusBadge({ status }: { status?: string | null }) {
  const label = RECORD_STATUS_LABELS[status ?? ""] ?? "Pendente"
  const className =
    status === "verified"
      ? "border-semantic-success-border bg-semantic-success-surface text-semantic-success"
      : status === "failed"
        ? "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger"
        : "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning"

  return (
    <Badge variant="outline" className={cn("whitespace-nowrap rounded-lg", className)}>
      {label}
    </Badge>
  )
}

function DomainStatusBadge({ status }: { status: StudioDomainStatus }) {
  const meta = DOMAIN_STATUS_META[status]
  const Icon = meta.icon
  return (
    <Badge variant="outline" className={cn("gap-1.5 whitespace-nowrap rounded-lg", meta.className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {meta.label}
    </Badge>
  )
}

function formatDate(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date)
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const output = (await response.json()) as {
    isValid?: boolean
    errorMessages?: string[]
    result?: T
  }
  if (!response.ok || output.isValid === false) {
    throw new Error(
      output.errorMessages?.join(", ") ?? "Não foi possível carregar o domínio studio",
    )
  }
  return output.result as T
}

function AuditDetails({ domain }: { domain: StudioDomain }) {
  const hasAuditData =
    domain.dnsAuditStatus ||
    domain.dnsReason ||
    domain.lastDnsAuditAt ||
    domain.lastDnsAttemptAt ||
    domain.recommendedCNAME
  if (!hasAuditData) return null

  return (
    <div className="rounded-lg border border-border/70 bg-surface-1 p-3 font-mono text-xs text-muted-foreground">
      <dl className="grid gap-2 sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt>Motivo</dt>
        <dd className="break-words text-foreground">{domain.dnsReason ?? "—"}</dd>
        <dt>Última auditoria</dt>
        <dd className="text-foreground">{formatDate(domain.lastDnsAuditAt)}</dd>
        <dt>Última tentativa</dt>
        <dd className="text-foreground">{formatDate(domain.lastDnsAttemptAt)}</dd>
        <dt>CNAME recomendado</dt>
        <dd className="break-all text-foreground">{domain.recommendedCNAME ?? "—"}</dd>
      </dl>
    </div>
  )
}

function AuditNotice({ domain }: { domain: StudioDomain }) {
  const auditStatus = domain.dnsAuditStatus
  const needsAction =
    domain.status === "pending" ||
    domain.status === "failed" ||
    auditStatus === "pending" ||
    auditStatus === "misconfigured" ||
    auditStatus === "failed" ||
    domain.dnsMisconfigured

  if (needsAction) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Ação necessária</AlertTitle>
        <AlertDescription>
          {domain.dnsReason ??
            "Revise o CNAME no provedor DNS e verifique novamente para publicar o domínio."}
        </AlertDescription>
      </Alert>
    )
  }

  if (auditStatus === "inconclusive") {
    return (
      <Alert className="border-semantic-info-border bg-semantic-info-surface text-foreground">
        <Info className="text-semantic-info" />
        <AlertTitle>Consulta temporariamente indisponível</AlertTitle>
        <AlertDescription>
          {domain.dnsReason ?? "A auditoria DNS não pôde ser concluída agora."}
        </AlertDescription>
      </Alert>
    )
  }

  return null
}

function CopyRecordButton({
  value,
  label,
  onCopy,
}: {
  value: string
  label: string
  onCopy: (value: string, label: string) => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 shrink-0 sm:size-8"
      aria-label={`Copiar ${label} ${value}`}
      onClick={() => onCopy(value, label)}
    >
      <Copy />
    </Button>
  )
}

export function StudioDomainCard() {
  const [domain, setDomain] = useState<StudioDomain | null>(null)
  const [suggestedHostname, setSuggestedHostname] = useState<string | null>(null)
  const [records, setRecords] = useState<DnsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await readJson<StudioDomainResponse>(
        `${API_CLIENT_BASE}/email/settings/studio-domain/records`,
      )
      setDomain(result.studioDomain)
      setSuggestedHostname(result.suggestedHostname ?? null)
      setRecords(result.records ?? [])
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Não foi possível carregar o domínio studio",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function verify() {
    if (verifying) return
    setVerifying(true)
    try {
      await readJson(`${API_CLIENT_BASE}/email/settings/studio-domain`, { method: "PATCH" })
      toast.success("Verificação do DNS solicitada")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível verificar o domínio")
    } finally {
      setVerifying(false)
    }
  }

  async function copyValue(value: string, label: string) {
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
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe2 className="size-4 text-primary" aria-hidden="true" />
          Domínio studio
        </CardTitle>
        <CardDescription>
          Um único subdomínio para formulários e páginas de conversão.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loadError ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Não foi possível carregar</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}
        {!domain && !suggestedHostname ? (
          <p className="text-sm text-muted-foreground">
            Conecte um domínio de envio para gerar automaticamente o subdomínio studio.
          </p>
        ) : null}
        {domain || suggestedHostname ? (
          <>
            <div className="flex flex-col gap-3 rounded-lg border bg-surface-1 p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="break-all font-mono text-sm">
                https://{domain?.hostname ?? suggestedHostname}
              </span>
              {domain ? <DomainStatusBadge status={domain.status} /> : null}
            </div>
            {!domain ? (
              <p className="text-xs text-muted-foreground">
                O endereço foi calculado a partir do domínio de envio conectado. O registro será
                acompanhado automaticamente.
              </p>
            ) : null}
            {domain ? <AuditNotice domain={domain} /> : null}
            <p className="text-xs text-muted-foreground">
              Estes são registros adicionais, separados de DKIM, SPF e tracking. Adicione-os no
              provedor DNS do domínio de envio para apontar o subdomínio studio para a aplicação
              pública.
            </p>
            {domain?.recommendedCNAME ? (
              <div className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">CNAME recomendado</p>
                  <code className="block break-all font-mono text-xs text-muted-foreground">
                    {domain.recommendedCNAME}
                  </code>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 shrink-0 sm:min-h-9"
                  aria-label="Copiar CNAME recomendado"
                  onClick={() => void copyValue(domain.recommendedCNAME!, "CNAME recomendado")}
                >
                  <Copy data-icon="inline-start" />
                  Copiar CNAME
                </Button>
              </div>
            ) : null}
            {domain ? <AuditDetails domain={domain} /> : null}
            {records.length > 0 ? (
              <>
                <Separator />
                <div className="flex flex-col gap-3">
                  <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-foreground">
                    Registros DNS do domínio studio
                  </p>
                  <div className="max-w-full overflow-x-auto rounded-lg border border-border/60 bg-background/80">
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
                            <TableCell className="font-mono text-xs">
                              {record.type ?? record.record}
                            </TableCell>
                            <TableCell>
                              <div className="flex max-w-xs items-start gap-2">
                                <span className="break-all font-mono text-xs text-foreground">
                                  {record.name}
                                </span>
                                <CopyRecordButton
                                  value={record.name}
                                  label="nome"
                                  onCopy={(value, label) => void copyValue(value, label)}
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex max-w-xs items-start gap-2">
                                <span className="break-all font-mono text-xs text-foreground">
                                  {record.value}
                                </span>
                                <CopyRecordButton
                                  value={record.value}
                                  label="valor"
                                  onCopy={(value, label) => void copyValue(value, label)}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{record.priority ?? "—"}</TableCell>
                            <TableCell className="text-xs">{record.ttl ?? "Auto"}</TableCell>
                            <TableCell>
                              <DnsStatusBadge status={record.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            ) : null}
            {domain && domain.status !== "verified" ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full"
                aria-label="Verificar DNS"
                onClick={() => void verify()}
                disabled={verifying}
              >
                <RefreshCw data-icon="inline-start" />
                {verifying ? "Verificando…" : "Verificar DNS"}
              </Button>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
