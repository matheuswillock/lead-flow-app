"use client"

import { useEffect } from "react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe,
  LoaderCircle,
  MoreHorizontal,
  Trash2,
  XCircle,
} from "lucide-react"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"
import type { ResendDomainStatus } from "../context/EmailSettingsTypes"
import { DomainEventsTimeline } from "./DomainEventsTimeline"
import { EmailSettingsSectionCard } from "./EmailSettingsSectionCard"
import { formatResendRegion } from "../utils/resend-region-labels"

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
      icon: <XCircle className="size-3" />,
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    },
    temporary_failure: {
      label: "Falha temporária",
      icon: <AlertCircle className="size-3" />,
      className: "border-semantic-warning/30 bg-semantic-warning-surface text-semantic-warning",
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
    domainEvents,
    connectingDomain,
    verifyingDomain,
    loadingRecords,
    disconnectingDomain,
    handleConnectDomain,
    handleDisconnectDomain,
    handleVerifyDomain,
    handleLoadDomainRecords,
  } = useEmailSettingsContext()

  useEffect(() => {
    if (domainName && domainRecords.length === 0) {
      void handleLoadDomainRecords()
    }
  }, [domainName, domainRecords.length, handleLoadDomainRecords])

  const isConnected = Boolean(domainName)

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
                    Verificar DNS
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
                          remove o domínio no Resend e os disparos voltarão ao domínio padrão.
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

          <DomainEventsTimeline events={domainEvents} domainStatus={domainStatus} />

          {domainStatus !== "verified" ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-[color:var(--surface-1)] p-5">
              <div className="flex flex-col gap-1">
                <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-foreground">
                  Registros DNS necessários
                </p>
                <p className="text-sm text-muted-foreground">
                  Configure os registros abaixo no seu provedor DNS e depois execute a verificação.
                </p>
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
                        <TableHead>Tipo</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>TTL</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {domainRecords.map((record, index) => (
                        <TableRow key={`${record.type}-${record.name}-${index}`}>
                          <TableCell className="font-mono text-xs">{record.type}</TableCell>
                          <TableCell className="max-w-52 truncate font-mono text-xs">{record.name}</TableCell>
                          <TableCell className="max-w-60 truncate font-mono text-xs">{record.value}</TableCell>
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
          ) : null}
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
                  Nenhum domínio conectado. Após a conexão, a tela exibirá os registros DNS exigidos pelo
                  Resend.
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        </div>
      )}
    </EmailSettingsSectionCard>
  )
}
