"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  Globe,
  LoaderCircle,
  Mail,
  MoreHorizontal,
  MousePointerClick,
  ShieldAlert,
  Sparkles,
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
  DropdownMenuSeparator,
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
import {
  groupDnsRecordsBySection,
  isDnsRecordVerified,
  type CustomDomainDnsRecord,
  type DnsRecordSection,
  type DnsRecordSectionKey,
} from "@/lib/email/custom-domain-dns-instructions"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"
import type { ResendDomainStatus } from "../context/EmailSettingsTypes"
import { DomainEventsTimeline } from "./DomainEventsTimeline"
import { EmailSettingsSectionCard } from "./EmailSettingsSectionCard"
import { SendDnsInstructionsDialog } from "./SendDnsInstructionsDialog"
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

function purposeLabel(record: CustomDomainDnsRecord): string {
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

function isTrackingRecord(record: CustomDomainDnsRecord): boolean {
  const purpose = record.record?.trim()
  return purpose === "Tracking" || purpose === "TrackingCAA"
}

/**
 * Paridade com painéis de provedor de e-mail: os registros são exibidos por
 * seção (Verificação do domínio / Envio / Tracking), cada uma com o próprio
 * banner de erro quando um registro falhou. Antes a tabela era única e todo
 * status não-verificado virava um relógio neutro — registro com VALOR ERRADO
 * no DNS (caso interplaza.com.br, 01/09) aparecia como "aguardando", e o
 * operador não tinha como saber qual linha corrigir. O agrupamento vive em
 * `lib/email/custom-domain-dns-instructions` porque as instruções copiadas e
 * o e-mail para a hospedagem seguem as mesmas seções.
 */
const SECTION_TITLES: Record<DnsRecordSectionKey, string> = {
  dkim: "Verificação do domínio (DKIM)",
  spf: "Envio (SPF)",
  tracking: "Tracking",
  receiving: "Recebimento",
  other: "Outros registros",
}

/**
 * Alerta por seção enquanto o registro segue pendente no DNS (o mesmo
 * comportamento do banner "records not found" de painéis de provedor).
 * Só DKIM e SPF bloqueiam o disparo — Tracking tem aviso informativo próprio.
 */
const SECTION_PENDING_ALERTS: Partial<
  Record<DnsRecordSectionKey, { title: string; description: string }>
> = {
  dkim: {
    title: "Registro de verificação do domínio (DKIM) não encontrado",
    description:
      "Ele é necessário para confirmar a propriedade do domínio — sem essa confirmação o disparo não é liberado. Cadastre o registro abaixo no DNS do seu domínio e, depois de corrigir, reinicie a verificação.",
  },
  spf: {
    title: "Registros de envio (SPF) não encontrados",
    description:
      "Sem eles o disparo não é liberado. Cadastre os registros abaixo no DNS do seu domínio e, depois de corrigir, reinicie a verificação.",
  },
}

function sectionFailures(section: DnsRecordSection): CustomDomainDnsRecord[] {
  return section.records.filter((record) => record.status === "failed")
}

function sectionTemporaryFailures(section: DnsRecordSection): CustomDomainDnsRecord[] {
  return section.records.filter((record) => record.status === "temporary_failure")
}

/** Registros ainda não encontrados no DNS (pendente/não iniciado) — falha tem banner próprio. */
function sectionAwaitingRecords(section: DnsRecordSection): CustomDomainDnsRecord[] {
  return section.records.filter(
    (record) =>
      !isDnsRecordVerified(record) &&
      record.status !== "failed" &&
      record.status !== "temporary_failure"
  )
}

function recordFailureSentence(record: CustomDomainDnsRecord): string {
  return `${purposeLabel(record)} ${record.type} inválido: o valor publicado no DNS está incorreto ou ausente. Atualize o registro "${record.name}" para o valor mostrado na tabela e clique em "Verificar DNS".`
}

const RECORD_STATUS_META: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
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
  temporary_failure: {
    label: "Falha temporária",
    icon: <AlertCircle className="size-3" />,
    className: "border-semantic-warning/30 bg-semantic-warning-surface text-semantic-warning",
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

function RecordStatusBadge({ status }: { status?: string }) {
  const meta = RECORD_STATUS_META[status ?? ""] ?? RECORD_STATUS_META.pending!
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap rounded-lg", meta.className)}>
      {meta.icon}
      {meta.label}
    </Badge>
  )
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
        className="size-7 max-lg:size-11 shrink-0"
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
    sendingDnsInstructions,
    canSendDnsInstructions,
    handleCopyDnsInstructions,
    handleCopyDnsInstructionsPrompt,
    handleSendDnsInstructions,
  } = useEmailSettingsContext()

  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false)
  const [sendInstructionsDialogOpen, setSendInstructionsDialogOpen] = useState(false)
  const [trackingSubdomainInput, setTrackingSubdomainInput] = useState(DEFAULT_TRACKING_SUBDOMAIN)
  const [openTrackingDraft, setOpenTrackingDraft] = useState(true)

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
    setTrackingDialogOpen(true)
  }

  async function submitTrackingConfig() {
    const subdomain = trackingSubdomainInput.trim().toLowerCase()
    if (!TRACKING_SUBDOMAIN_RE.test(subdomain)) {
      toast.error("Subdomínio inválido. Use apenas letras minúsculas, números e hífen (ex.: links).")
      return
    }
    if (!openTrackingDraft) {
      toast.error("Habilite a abertura para configurar o tracking.")
      return
    }

    const ok = await handleConfigureDomainTracking({
      trackingSubdomain: subdomain,
      openTracking: openTrackingDraft,
      // Sempre `false`. O backend também força — ver a rota
      // `PATCH /email/settings/domain/tracking`.
      clickTracking: false,
    })
    if (ok) setTrackingDialogOpen(false)
  }

  return (
    <EmailSettingsSectionCard
      icon={Globe}
      title="Domínio personalizado"
      description="Conecte um domínio próprio para fortalecer a identidade da sua operação."
      contentClassName="flex flex-col gap-6"
    >
      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : isConnected ? (
        <>
          {/*
            Renderiza o motivo real vindo do servidor. Antes o título e o texto
            eram fixos ("Habilite as métricas de tracking"), então esta tela e a
            de Campanhas diziam coisas diferentes sobre o mesmo domínio — e a
            orientação podia apontar para o botão errado.
          */}
          {domainDispatchWarnings.length > 0 ? (
            <Alert className="border-semantic-warning/30 bg-semantic-warning-surface text-foreground">
              <ShieldAlert className="size-4 text-semantic-warning" />
              <AlertTitle>Atenção com o domínio</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                {domainDispatchWarnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </AlertDescription>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="max-lg:size-11"
                    disabled={disconnectingDomain}
                  >
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={domainRecords.length === 0}
                    onClick={() => void handleCopyDnsInstructions()}
                  >
                    <ClipboardList data-icon="inline-start" />
                    Copiar instruções
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={domainRecords.length === 0}
                    onClick={() => void handleCopyDnsInstructionsPrompt()}
                  >
                    <Sparkles data-icon="inline-start" />
                    Copiar como prompt de IA
                  </DropdownMenuItem>
                  {canSendDnsInstructions ? (
                    <DropdownMenuItem
                      disabled={sendingDnsInstructions}
                      onClick={() => setSendInstructionsDialogOpen(true)}
                    >
                      <Mail data-icon="inline-start" />
                      Enviar por e-mail
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
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
                          remove o domínio da plataforma e os disparos voltarão a usar{" "}
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
              <Button type="button" variant="outline" className="max-lg:h-11" onClick={openTrackingDialog}>
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
                className="max-lg:h-11"
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
                Desative o proxy Cloudflare (nuvem laranja) nos registros CNAME/MX/TXT do e-mail.
              </p>
              <p>
                DMARC (opcional): adicione um TXT em <span className="font-mono text-xs">_dmarc</span> no
                domínio raiz para reforçar a autenticidade — não é exigido para verificar o
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
              <div className="flex flex-col gap-5">
                {groupDnsRecordsBySection(domainRecords).map((section) => {
                  const failures = sectionFailures(section)
                  const temporaryFailures = sectionTemporaryFailures(section)
                  const awaitingRecords = sectionAwaitingRecords(section)
                  const pendingAlert = SECTION_PENDING_ALERTS[section.key]
                  return (
                    <div key={section.key} className="flex flex-col gap-3">
                      <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-foreground">
                        {SECTION_TITLES[section.key]}
                      </p>
                      {pendingAlert && awaitingRecords.length > 0 ? (
                        <Alert variant="destructive">
                          <AlertCircle className="size-4" />
                          <AlertTitle>{pendingAlert.title}</AlertTitle>
                          <AlertDescription className="flex flex-col items-start gap-3">
                            <span>{pendingAlert.description}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="max-lg:h-11"
                              onClick={() => void handleVerifyDomain()}
                              disabled={verifyingDomain || loadingRecords}
                            >
                              {verifyingDomain ? (
                                <LoaderCircle data-icon="inline-start" className="animate-spin" />
                              ) : (
                                <Clock data-icon="inline-start" />
                              )}
                              Reiniciar verificação
                            </Button>
                          </AlertDescription>
                        </Alert>
                      ) : null}
                      {section.key === "tracking" && awaitingRecords.length > 0 ? (
                        <Alert className="border-border/60 bg-[color:var(--surface-1)] text-foreground">
                          <MousePointerClick className="size-4 text-muted-foreground" />
                          <AlertTitle>Registro de tracking pendente</AlertTitle>
                          <AlertDescription>
                            Ele não bloqueia o disparo. Cadastre o registro abaixo quando quiser
                            medir as aberturas dos seus e-mails.
                          </AlertDescription>
                        </Alert>
                      ) : null}
                      {failures.length > 0 ? (
                        <Alert variant="destructive">
                          <AlertCircle className="size-4" />
                          <AlertTitle>Registro com valor incorreto</AlertTitle>
                          <AlertDescription className="flex flex-col gap-1">
                            {failures.map((record) => (
                              <span key={`${record.type}-${record.name}`}>
                                {recordFailureSentence(record)}
                              </span>
                            ))}
                          </AlertDescription>
                        </Alert>
                      ) : null}
                      {temporaryFailures.length > 0 ? (
                        <Alert className="border-semantic-warning/30 bg-semantic-warning-surface text-foreground">
                          <AlertCircle className="size-4 text-semantic-warning" />
                          <AlertTitle>Falha temporária na verificação</AlertTitle>
                          <AlertDescription className="flex flex-col gap-1">
                            {temporaryFailures.map((record) => (
                              <span key={`${record.type}-${record.name}`}>
                                {purposeLabel(record)} {record.type}: a última checagem não conseguiu
                                confirmar o registro. Confira o valor e clique em &quot;Verificar
                                DNS&quot;.
                              </span>
                            ))}
                          </AlertDescription>
                        </Alert>
                      ) : null}
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
                            {section.records.map((record, index) => (
                              <TableRow
                                key={`${record.type}-${record.name}-${index}`}
                                className={cn(
                                  isTrackingRecord(record) && "bg-primary/5",
                                  record.status === "failed" && "bg-destructive/5"
                                )}
                              >
                                <TableCell className="text-xs font-medium">
                                  {purposeLabel(record)}
                                </TableCell>
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
                                <TableCell className="text-xs">{record.ttl ?? "Auto"}</TableCell>
                                <TableCell>
                                  <RecordStatusBadge status={record.status} />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum registro DNS disponível para este domínio.
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
                      className="max-lg:h-12 max-lg:w-12 max-lg:px-1.5 max-lg:py-3.5 max-lg:[background-clip:content-box]"
                    />
                  </Field>

                  <FieldDescription>
                    Cliques não são rastreados de propósito: ligar isso
                    reescreve todo link do e-mail para o subdomínio de tracking, e
                    provedores marcam a mensagem como suspeita. Os cliques já são
                    medidos no próprio formulário.
                  </FieldDescription>
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
                    !openTrackingDraft
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

          <SendDnsInstructionsDialog
            open={sendInstructionsDialogOpen}
            onOpenChange={setSendInstructionsDialogOpen}
            domainName={domainName ?? ""}
            sending={sendingDnsInstructions}
            onSend={handleSendDnsInstructions}
          />
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
                    className="max-lg:h-11"
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
