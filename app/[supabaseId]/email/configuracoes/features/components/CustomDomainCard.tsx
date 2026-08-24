"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Globe,
  LoaderCircle,
  MoreHorizontal,
  MousePointerClick,
  ShieldAlert,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE } from "@/lib/email/campaign-dispatch-guards"
import { PLATFORM_FROM_EMAIL } from "@/lib/email/resolve-campaign-from"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"
import type { DomainRecord, ResendDomainStatus } from "../context/EmailSettingsTypes"
import { DomainEventsTimeline } from "./DomainEventsTimeline"
import { EmailSettingsSectionCard } from "./EmailSettingsSectionCard"
import { formatResendRegion } from "../utils/resend-region-labels"

const DEFAULT_TRACKING_SUBDOMAIN = "links"
const TRACKING_SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

function DomainStatusBadge({ status }: { status: ResendDomainStatus | null }) {
  if (!status) {
    return (
      <Badge variant="outline" className="rounded-lg text-muted-foreground">
        Não conectado
      </Badge>
    )
  }

  const map: Record<ResendDomainStatus, { label: string; icon: React.ReactNode; className: string }> = {
    verified: {
      label: "Verificado",
      icon: <CheckCircle2 className="size-3" />,
      className: "border-semantic-success/30 bg-semantic-success/10 text-semantic-success",
    },
    pending: {
      label: "Pendente",
      icon: <Clock className="size-3" />,
      className: "border-semantic-warning/30 bg-semantic-warning-surface text-semantic-warning",
    },
    not_started: {
      label: "Não iniciado",
      icon: <Globe className="size-3" />,
      className: "border-border bg-background text-muted-foreground",
    },
    failed: {
      label: "Falhou",
      icon: <AlertCircle className="size-3" />,
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    },
    temporary_failure: {
      label: "Falha temporária",
      icon: <AlertCircle className="size-3" />,
      className: "border-semantic-warning/30 bg-semantic-warning-surface text-semantic-warning",
    },
    partially_verified: {
      label: "Parcialmente verificado",
      icon: <Clock className="size-3" />,
      className: "border-semantic-warning/30 bg-semantic-warning-surface text-semantic-warning",
    },
    partially_failed: {
      label: "Falha parcial",
      icon: <AlertCircle className="size-3" />,
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    },
  }

  const config = map[status]

  return (
    <Badge variant="outline" className={cn("gap-1 rounded-lg", config.className)}>
      {config.icon}
      {config.label}
    </Badge>
  )
}

function TrackingBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-lg",
        enabled
          ? "border-semantic-success/30 text-semantic-success"
          : "border-border text-muted-foreground"
      )}
    >
      {label}: {enabled ? "Habilitado" : "Desabilitado"}
    </Badge>
  )
}

function purposeLabel(record: DomainRecord): string {
  const purpose = record.record?.trim()
  if (!purpose) return "—"
  const labels: Record<string, string> = {
    SPF: "SPF",
    DKIM: "DKIM",
    Tracking: "Tracking",
    TrackingCAA: "Tracking CAA",
    Receiving: "Recebimento",
  }
  return labels[purpose] ?? purpose
}

function isTrackingRecord(record: DomainRecord): boolean {
  const purpose = record.record?.trim()
  return purpose === "Tracking" || purpose === "TrackingCAA"
}

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copiado`)
  } catch {
    toast.error("Não foi possível copiar")
  }
}

function CopyableCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex max-w-xs items-start gap-2">
      <span className="break-all font-mono text-xs text-foreground">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={() => void copyToClipboard(value, label)}
        aria-label={`Copiar ${label}`}
      >
        <Copy />
      </Button>
    </div>
  )
}

export function CustomDomainCard() {
  const {
    loading,
    domainInput,
    setDomainInput,
    domainRecords,
    domainStatus,
    domainName,
    domainRegion,
    domainConnectedAt,
    domainOpenTracking,
    domainClickTracking,
    domainTrackingSubdomain,
    domainDispatchWarnings,
    domainEvents,
    connectingDomain,
    verifyingDomain,
    loadingRecords,
    disconnectingDomain,
    configuringDomainTracking,
    handleConnectDomain,
    handleDisconnectDomain,
    handleVerifyDomain,
    handleLoadDomainRecords,
    handleConfigureDomainTracking,
  } = useEmailSettingsContext()

  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false)
  const [trackingSubdomainInput, setTrackingSubdomainInput] = useState(DEFAULT_TRACKING_SUBDOMAIN)
  const [openTrackingDraft, setOpenTrackingDraft] = useState(true)
  // Cliques desligados por padrão: ligar reescreve todo href do template para o
  // subdomínio de tracking, e esse redirecionador é sinalizado como suspeito
  // pelo Safe Browsing. O clique é medido no first-party pelo `cs_el`.
  const [clickTrackingDraft, setClickTrackingDraft] = useState(false)

  useEffect(() => {
    if (domainName && domainRecords.length === 0) {
      void handleLoadDomainRecords()
    }
  }, [domainName, domainRecords.length, handleLoadDomainRecords])

  const isConnected = Boolean(domainName)
  const verifyLabel = domainStatus === "verified" ? "Reverificar DNS" : "Verificar DNS"
  const hasTrackingConfigured = Boolean(domainTrackingSubdomain?.trim())
  const trackingPreviewHost = domainName
    ? `${trackingSubdomainInput.trim() || DEFAULT_TRACKING_SUBDOMAIN}.${domainName}`
    : trackingSubdomainInput.trim() || DEFAULT_TRACKING_SUBDOMAIN

  function openTrackingDialog() {
    setTrackingSubdomainInput(domainTrackingSubdomain?.trim() || DEFAULT_TRACKING_SUBDOMAIN)
    setOpenTrackingDraft(hasTrackingConfigured ? domainOpenTracking : true)
    setClickTrackingDraft(hasTrackingConfigured ? domainClickTracking : false)
    setTrackingDialogOpen(true)
  }

  async function submitTrackingConfig() {
    const subdomain = trackingSubdomainInput.trim().toLowerCase()
    if (!TRACKING_SUBDOMAIN_RE.test(subdomain)) {
      toast.error("Subdomínio inválido. Use apenas letras minúsculas, números e hífen (ex.: links).")
      return
    }
    if (!openTrackingDraft && !clickTrackingDraft) {
      toast.error("Habilite pelo menos abertura ou cliques.")
      return
    }

    const ok = await handleConfigureDomainTracking({
      trackingSubdomain: subdomain,
      openTracking: openTrackingDraft,
      clickTracking: clickTrackingDraft,
    })
    if (ok) setTrackingDialogOpen(false)
  }

  return (
    <EmailSettingsSectionCard
      icon={Globe}
      title="Domínio personalizado"
      description="Conecte um domínio próprio ao Resend para fortalecer a identidade da sua operação."
      contentClassName="flex flex-col gap-6"
    >
      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : isConnected ? (
        <>
          {domainDispatchWarnings.length > 0 ? (
            <Alert className="border-semantic-warning/30 bg-semantic-warning-surface text-foreground">
              <ShieldAlert className="size-4 text-semantic-warning" />
              <AlertTitle>Habilite as métricas de tracking</AlertTitle>
              <AlertDescription>{RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-[color:var(--surface-1)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-semantic-success/30 bg-semantic-success/10 text-semantic-success">
                  <Globe className="size-5" />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Domínio
                  </p>
                  <p className="truncate font-[family-name:var(--font-poppins)] text-xl font-semibold text-foreground">
                    {domainName}
                  </p>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="icon" disabled={disconnectingDomain}>
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">Ações do domínio</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={verifyingDomain || loadingRecords}
                    onClick={() => void handleVerifyDomain()}
                  >
                    <Clock data-icon="inline-start" />
                    {verifyLabel}
                  </DropdownMenuItem>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        disabled={disconnectingDomain}
                        onSelect={(event) => event.preventDefault()}
                      >
                        <Trash2 data-icon="inline-start" />
                        Deletar domínio
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deletar domínio</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja remover o domínio <strong>{domainName}</strong>? Esta ação
                          remove o domínio no Resend e os disparos voltarão a usar{" "}
                          {PLATFORM_FROM_EMAIL}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleDisconnectDomain()}>
                          Deletar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Criado
                </p>
                <p className="text-sm font-medium text-foreground">
                  {domainConnectedAt
                    ? formatDistanceToNow(new Date(domainConnectedAt), { addSuffix: true, locale: ptBR })
                    : "—"}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </p>
                <DomainStatusBadge status={domainStatus} />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Região
                </p>
                <p className="text-sm font-medium text-foreground">{formatResendRegion(domainRegion)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <TrackingBadge enabled={domainOpenTracking} label="Abertura" />
              <TrackingBadge enabled={domainClickTracking} label="Cliques" />
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-[color:var(--surface-1)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background text-muted-foreground">
                  <MousePointerClick className="size-4" />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-foreground">
                    Métricas de tracking
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Para rastrear aberturas e cliques, configure um subdomínio de tracking alinhado ao seu
                    domínio de envio.
                  </p>
                  {hasTrackingConfigured ? (
                    <p className="text-sm text-foreground">
                      Subdomínio:{" "}
                      <span className="font-mono text-xs">
                        {domainTrackingSubdomain}.{domainName}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
              <Button type="button" variant="outline" onClick={openTrackingDialog}>
                {hasTrackingConfigured ? "Alterar" : "Configurar"}
              </Button>
            </div>
          </div>

          <DomainEventsTimeline events={domainEvents} domainStatus={domainStatus} />

          <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-[color:var(--surface-1)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-foreground">
                  Registros DNS
                </p>
                <p className="text-sm text-muted-foreground">
                  Copie Nome e Valor e cadastre no host DNS do seu domínio. Os registros ficam sempre
                  disponíveis, mesmo após a verificação.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => void handleVerifyDomain()}
                disabled={verifyingDomain || loadingRecords}
              >
                {verifyingDomain ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Clock data-icon="inline-start" />
                )}
                {verifyLabel}
              </Button>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-semantic-warning" />
                Prefira um subdomínio (ex.: mail.suaempresa.com.br) para evitar conflito com MX do e-mail
                corporativo.
              </p>
              <p>
                Desative o proxy Cloudflare (nuvem laranja) nos registros CNAME/MX/TXT do Resend.
              </p>
              <p>
                DMARC (opcional): adicione um TXT em <span className="font-mono text-xs">_dmarc</span> no
                domínio raiz para reforçar a autenticidade — não é exigido pelo Resend para verificar o
                domínio.
              </p>
              {hasTrackingConfigured ? (
                <p>
                  Após configurar o tracking, cadastre também o CNAME de Tracking e clique em {verifyLabel}.
                </p>
              ) : null}
            </div>

            {loadingRecords ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : domainRecords.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-border/60 bg-background/80">
                <Table>
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
                    {domainRecords.map((record, index) => (
                      <TableRow
                        key={`${record.type}-${record.name}-${index}`}
                        className={cn(isTrackingRecord(record) && "bg-primary/5")}
                      >
                        <TableCell className="text-xs font-medium">{purposeLabel(record)}</TableCell>
                        <TableCell className="font-mono text-xs">{record.type}</TableCell>
                        <TableCell>
                          <CopyableCell value={record.name} label="Nome" />
                        </TableCell>
                        <TableCell>
                          <CopyableCell value={record.value} label="Valor" />
                        </TableCell>
                        <TableCell className="text-xs">
                          {record.priority !== undefined && record.priority !== null
                            ? record.priority
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{record.ttl}</TableCell>
                        <TableCell>
                          {record.status === "verified" ? (
                            <CheckCircle2 className="size-4 text-semantic-success" />
                          ) : (
                            <Clock className="size-4 text-semantic-warning" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum registro retornado pelo Resend para este domínio.
              </p>
            )}
          </div>

          <Dialog open={trackingDialogOpen} onOpenChange={setTrackingDialogOpen}>
            <DialogContent className="max-h-[90vh] flex flex-col gap-0 p-0 sm:max-w-lg">
              <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-4">
                <DialogTitle>Configurar métricas de tracking</DialogTitle>
                <DialogDescription>
                  Defina o subdomínio e quais métricas deseja habilitar. Depois, adicione o registro DNS de
                  Tracking e re-verifique.
                </DialogDescription>
              </DialogHeader>

              <div className="overflow-y-auto flex-1 px-6 py-4">
                <FieldGroup className="gap-5">
                  <Field>
                    <FieldLabel htmlFor="tracking-subdomain-input">Subdomínio de tracking</FieldLabel>
                    <FieldContent>
                      <Input
                        id="tracking-subdomain-input"
                        value={trackingSubdomainInput}
                        onChange={(event) => setTrackingSubdomainInput(event.target.value.toLowerCase())}
                        placeholder={DEFAULT_TRACKING_SUBDOMAIN}
                        disabled={configuringDomainTracking}
                        autoComplete="off"
                      />
                      <FieldDescription>
                        Preview: <span className="font-mono text-xs">{trackingPreviewHost}</span>
                      </FieldDescription>
                    </FieldContent>
                  </Field>

                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor="open-tracking-switch">Abertura</FieldLabel>
                      <FieldDescription>Rastreia quando o e-mail é aberto.</FieldDescription>
                    </FieldContent>
                    <Switch
                      id="open-tracking-switch"
                      checked={openTrackingDraft}
                      onCheckedChange={setOpenTrackingDraft}
                      disabled={configuringDomainTracking}
                    />
                  </Field>

                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor="click-tracking-switch">Cliques</FieldLabel>
                      <FieldDescription>Rastreia cliques nos links do e-mail.</FieldDescription>
                    </FieldContent>
                    <Switch
                      id="click-tracking-switch"
                      checked={clickTrackingDraft}
                      onCheckedChange={setClickTrackingDraft}
                      disabled={configuringDomainTracking}
                    />
                  </Field>
                </FieldGroup>
              </div>

              <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTrackingDialogOpen(false)}
                  disabled={configuringDomainTracking}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void submitTrackingConfig()}
                  disabled={
                    configuringDomainTracking ||
                    !trackingSubdomainInput.trim() ||
                    (!openTrackingDraft && !clickTrackingDraft)
                  }
                >
                  {configuringDomainTracking ? (
                    <LoaderCircle data-icon="inline-start" className="animate-spin" />
                  ) : null}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-[color:var(--surface-1)] p-5">
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="custom-domain-input">Adicionar domínio</FieldLabel>
              <FieldContent>
                <div className="flex flex-col gap-3 md:flex-row">
                  <Input
                    id="custom-domain-input"
                    placeholder="Ex: mail.suaempresa.com.br"
                    value={domainInput}
                    onChange={(event) => setDomainInput(event.target.value)}
                    disabled={connectingDomain}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleConnectDomain()
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => void handleConnectDomain()}
                    disabled={connectingDomain || !domainInput.trim()}
                  >
                    {connectingDomain ? (
                      <LoaderCircle data-icon="inline-start" className="animate-spin" />
                    ) : (
                      <Globe data-icon="inline-start" />
                    )}
                    Conectar
                  </Button>
                </div>
                <FieldDescription>
                  Prefira um subdomínio (ex.: mail.suaempresa.com.br). Após conectar, copie os registros
                  DNS e configure no host do domínio.
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        </div>
      )}
    </EmailSettingsSectionCard>
  )
}
