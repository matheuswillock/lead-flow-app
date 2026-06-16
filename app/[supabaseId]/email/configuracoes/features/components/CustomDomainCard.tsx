"use client"

import { useEffect } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe,
  LoaderCircle,
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
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"
import type { ResendDomainStatus } from "../context/EmailSettingsTypes"
import { EmailSettingsSectionCard } from "./EmailSettingsSectionCard"

function DomainStatusBadge({ status }: { status: ResendDomainStatus | null }) {
  if (!status) return null

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

export function CustomDomainCard() {
  const {
    loading,
    domainInput,
    setDomainInput,
    domainRecords,
    domainStatus,
    domainName,
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
      ) : domainName ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-[color:var(--surface-1)] p-5">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-[family-name:var(--font-poppins)] text-base font-semibold text-foreground">
                  {domainName}
                </p>
                <DomainStatusBadge status={domainStatus} />
              </div>
              <p className="text-sm text-muted-foreground">
                Quando verificado, os emails passam a sair do seu domínio corporativo.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleVerifyDomain()}
                disabled={verifyingDomain || loadingRecords}
              >
                {verifyingDomain ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Clock data-icon="inline-start" />}
                Verificar DNS
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" disabled={disconnectingDomain}>
                    Desconectar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar domínio</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja desconectar o domínio <strong>{domainName}</strong>? Os disparos voltarão a usar o domínio padrão do Corretor Studio.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void handleDisconnectDomain()}>
                      Desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {domainStatus !== "verified" ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-[color:var(--surface-1)] p-5">
              <div className="flex flex-col gap-1">
                <FieldTitle>Registros DNS necessários</FieldTitle>
                <FieldDescription>
                  Configure os registros abaixo no seu provedor DNS e depois execute a verificação.
                </FieldDescription>
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
                <p className="text-sm text-muted-foreground">Nenhum registro retornado pelo Resend para este domínio.</p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-semantic-success/30 bg-semantic-success/10 p-5 text-sm text-foreground">
              <div className="flex items-center gap-2 font-[family-name:var(--font-poppins)] font-semibold text-semantic-success">
                <CheckCircle2 className="size-4" />
                Domínio verificado
              </div>
              <p className="mt-2 text-muted-foreground">
                Seus emails já podem sair a partir de <strong>{domainName}</strong>.
              </p>
            </div>
          )}
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
                    {connectingDomain ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Globe data-icon="inline-start" />}
                    Conectar
                  </Button>
                </div>
                <FieldDescription>
                  Nenhum domínio conectado. Após a conexão, a tela exibirá os registros DNS exigidos pelo Resend.
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        </div>
      )}
    </EmailSettingsSectionCard>
  )
}
