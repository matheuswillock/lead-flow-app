"use client"

import { useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  Link2,
  LoaderCircle,
  Mail,
  MoreHorizontal,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"
import type { FormDomainStatus } from "../context/EmailSettingsTypes"
import { EmailSettingsSectionCard } from "./EmailSettingsSectionCard"
import { SendDnsInstructionsDialog } from "./SendDnsInstructionsDialog"

/**
 * `w-fit` pelo mesmo motivo do badge do domínio de envio: filho direto de
 * `flex flex-col` estica por `align-items: stretch` e o badge viraria faixa.
 */
function FormDomainStatusBadge({ status }: { status: FormDomainStatus }) {
  const map: Record<FormDomainStatus, { label: string; icon: React.ReactNode; className: string }> = {
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
    failed: {
      label: "Falhou",
      icon: <AlertCircle className="size-3" />,
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    },
  }

  const config = map[status]

  return (
    <Badge
      variant="outline"
      data-testid="form-domain-status-badge"
      className={cn("w-fit gap-1 rounded-lg", config.className)}
    >
      {config.icon}
      {config.label}
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

/**
 * Domínio dos formulários (Frente C — Deliverability): o time serve os
 * formulários públicos no próprio subdomínio (forms.<dominio>) e os links de
 * campanha passam a apontar para ele — isolando a reputação de link do time.
 */
export function FormsDomainCard() {
  const {
    loading,
    formDomain,
    formDomainInput,
    setFormDomainInput,
    formDomainRecords,
    canManageFormDomain,
    canSendFormDomainDnsInstructions,
    connectingFormDomain,
    verifyingFormDomain,
    disconnectingFormDomain,
    loadingFormDomainRecords,
    sendingFormDomainDnsInstructions,
    handleConnectFormDomain,
    handleDisconnectFormDomain,
    handleVerifyFormDomain,
    handleCopyFormDomainDnsInstructions,
    handleCopyFormDomainDnsInstructionsPrompt,
    handleSendFormDomainDnsInstructions,
  } = useEmailSettingsContext()

  const [sendInstructionsDialogOpen, setSendInstructionsDialogOpen] = useState(false)

  if (!canManageFormDomain) return null

  const isVerified = formDomain?.status === "verified"

  return (
    <EmailSettingsSectionCard
      icon={Link2}
      title="Domínio dos formulários"
      description="Sirva seus formulários no seu próprio subdomínio e proteja a reputação dos links das suas campanhas."
      contentClassName="flex flex-col gap-6"
    >
      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : formDomain ? (
        <>
          <div className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-[color:var(--surface-1)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <div
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-2xl border",
                    isVerified
                      ? "border-semantic-success/30 bg-semantic-success/10 text-semantic-success"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  <Link2 className="size-5" />
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Subdomínio
                  </p>
                  <p className="truncate font-[family-name:var(--font-poppins)] text-xl font-semibold text-foreground">
                    {formDomain.hostname}
                  </p>
                  <FormDomainStatusBadge status={formDomain.status} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="max-lg:h-11"
                  disabled={verifyingFormDomain || loadingFormDomainRecords}
                  onClick={() => void handleVerifyFormDomain()}
                >
                  {verifyingFormDomain ? (
                    <LoaderCircle data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <Clock data-icon="inline-start" />
                  )}
                  Verificar agora
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="max-lg:size-11"
                      disabled={disconnectingFormDomain}
                    >
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Ações do domínio de formulários</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={formDomainRecords.length === 0}
                      onClick={() => void handleCopyFormDomainDnsInstructions()}
                    >
                      <ClipboardList data-icon="inline-start" />
                      Copiar instruções
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={formDomainRecords.length === 0}
                      onClick={() => void handleCopyFormDomainDnsInstructionsPrompt()}
                    >
                      <Sparkles data-icon="inline-start" />
                      Copiar como prompt de IA
                    </DropdownMenuItem>
                    {canSendFormDomainDnsInstructions ? (
                      <DropdownMenuItem
                        disabled={sendingFormDomainDnsInstructions}
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
                          disabled={disconnectingFormDomain}
                          onSelect={(event) => event.preventDefault()}
                        >
                          <Trash2 data-icon="inline-start" />
                          Remover domínio
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover domínio de formulários?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Os links de formulário das próximas campanhas voltarão a usar o
                            endereço padrão da plataforma. Links já enviados com{" "}
                            <strong>{formDomain.hostname}</strong> deixarão de abrir.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void handleDisconnectFormDomain()}>
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {isVerified ? (
              <Alert className="border-semantic-success/30 bg-semantic-success/10 text-foreground">
                <CheckCircle2 className="size-4 text-semantic-success" />
                <AlertTitle>Domínio verificado</AlertTitle>
                <AlertDescription>
                  Os novos links de campanha usarão este domínio.
                </AlertDescription>
              </Alert>
            ) : formDomain.status === "failed" ? (
              <Alert className="border-destructive/30 bg-destructive/10 text-destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Domínio inativo</AlertTitle>
                <AlertDescription className="text-destructive">
                  O subdomínio não está mais ativo na plataforma. Remova e conecte novamente.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-semantic-warning/30 bg-semantic-warning-surface text-foreground">
                <Clock className="size-4 text-semantic-warning" />
                <AlertTitle>Aguardando DNS</AlertTitle>
                <AlertDescription>
                  Crie o registro CNAME na hospedagem do seu domínio para ativar.
                </AlertDescription>
              </Alert>
            )}

            {!isVerified && formDomainRecords.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formDomainRecords.map((record) => (
                      <TableRow key={`${record.type}-${record.name}-${record.value}`}>
                        <TableCell className="font-mono text-xs">{record.type}</TableCell>
                        <TableCell>
                          <CopyableCell value={record.name} label="Nome" />
                        </TableCell>
                        <TableCell>
                          <CopyableCell value={record.value} label="Valor" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>

          <SendDnsInstructionsDialog
            open={sendInstructionsDialogOpen}
            onOpenChange={setSendInstructionsDialogOpen}
            domainName={formDomain.hostname}
            sending={sendingFormDomainDnsInstructions}
            onSend={handleSendFormDomainDnsInstructions}
          />
        </>
      ) : (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="form-domain-hostname">Subdomínio dos formulários</FieldLabel>
            <FieldContent>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  id="form-domain-hostname"
                  value={formDomainInput}
                  onChange={(event) => setFormDomainInput(event.target.value)}
                  placeholder="forms.suaempresa.com.br"
                  autoComplete="off"
                  className="sm:max-w-sm"
                />
                <Button
                  type="button"
                  className="max-lg:h-11"
                  disabled={connectingFormDomain || formDomainInput.trim().length === 0}
                  onClick={() => void handleConnectFormDomain()}
                >
                  {connectingFormDomain ? (
                    <LoaderCircle data-icon="inline-start" className="animate-spin" />
                  ) : null}
                  Conectar subdomínio
                </Button>
              </div>
              <FieldDescription>
                Seus formulários passam a abrir em um endereço seu (ex.:
                forms.suaempresa.com.br) e os links das campanhas ganham a reputação do seu
                domínio.
              </FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>
      )}
    </EmailSettingsSectionCard>
  )
}
