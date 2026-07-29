"use client"

import Link from "next/link"
import { useState } from "react"
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  Edit3,
  FileCheck2,
  Info,
  Mail,
  MoreVertical,
  Receipt,
  Share2,
  Wallet,
} from "lucide-react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useBackofficeClientInvoiceDetails } from "../context/BackofficeClientInvoiceDetailsContext"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone, parseDateKeyToUtc } from "@/lib/dates"

const STATUS_BADGES: Record<
  "paid" | "overdue" | "upcoming" | "other",
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
    className?: string
  }
> = {
  paid: {
    label: "Paga",
    variant: "outline",
    className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  },
  overdue: {
    label: "Vencida",
    variant: "outline",
    className: "border-red-500/40 bg-red-500/15 text-red-300",
  },
  upcoming: {
    label: "A vencer",
    variant: "outline",
    className: "border-orange-500/40 bg-orange-500/20 text-orange-200",
  },
  other: { label: "Em processamento", variant: "secondary" },
}

const BILLING_LABELS: Record<string, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de crédito",
  EXTERNAL: "Pago externamente",
  UNDEFINED: "Não definido",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(value: string | null, tz: string) {
  if (!value) return "—"
  const parsed =
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseDateKeyToUtc(value, tz)
      : new Date(value)
  return formatIntimezone(parsed, "dd/MM/yyyy", tz)
}

export function BackofficeClientInvoiceDetailsContainer() {
  const { tz } = useTimezone()
  const {
    invoice,
    isLoading,
    isSendingNotification,
    isUpdatingInvoice,
    error,
    reload,
    sendStatusNotification,
    updateInvoice,
  } = useBackofficeClientInvoiceDetails()
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editValue, setEditValue] = useState("")
  const [editDueDate, setEditDueDate] = useState("")
  const params = useParams()
  const masterId = params.masterId as string
  const backHref = `/backoffice/clients/${masterId}?tab=invoices`

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para faturas
          </Link>
        </Button>
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground flex items-center justify-between">
            <span>{error || "Não foi possível carregar a fatura."}</span>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Recarregar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentInvoice = invoice
  const isExternalAdhesionInvoice = currentInvoice.source === "adhesion_external"
  const statusBadge = STATUS_BADGES[currentInvoice.statusGroup]
  const isPaidInvoice = currentInvoice.statusGroup === "paid"
  const canEditInvoice =
    !isExternalAdhesionInvoice &&
    !currentInvoice.deleted &&
    (currentInvoice.statusGroup === "upcoming" || currentInvoice.statusGroup === "overdue")
  const hasReceipt = Boolean(currentInvoice.transactionReceiptUrl)
  const canSendNotification =
    !isExternalAdhesionInvoice &&
    (currentInvoice.statusGroup === "upcoming" || currentInvoice.statusGroup === "overdue")
  const notificationLabel =
    currentInvoice.statusGroup === "overdue"
      ? "Disparar e-mail de assinatura vencida"
      : "Disparar e-mail de assinatura a vencer"

  function handleNoopAction() {
    return undefined
  }

  function handleOpenEditDialog() {
    if (!invoice) return
    setEditValue(String(invoice.value))
    setEditDueDate(invoice.dueDate?.slice(0, 10) ?? "")
    setIsEditOpen(true)
  }

  async function handleSaveInvoiceEdit() {
    if (isUpdatingInvoice) return

    const value = Number.parseFloat(editValue.replace(",", "."))
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um valor válido maior que zero")
      return
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDueDate)) {
      toast.error("Informe uma data de vencimento válida")
      return
    }

    try {
      await updateInvoice({ value, dueDate: editDueDate })
      toast.success("Cobrança atualizada com sucesso")
      setIsEditOpen(false)
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Erro ao atualizar a cobrança"
      toast.error(message)
    }
  }

  function handleOpenReceiptModal() {
    setIsReceiptModalOpen(true)
  }

  async function handleSendStatusNotification() {
    try {
      const message = await sendStatusNotification()
      toast.success(message)
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Erro ao enviar notificação"
      toast.error(message)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para faturas
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <span>
                {invoice.invoiceName} · {invoice.invoiceIdDisplay}
              </span>
              <Badge variant={statusBadge.variant} className={statusBadge.className}>
                {isExternalAdhesionInvoice
                  ? "Pago externamente"
                  : invoice.status === "WAIVED"
                    ? "Dispensada"
                    : statusBadge.label}
              </Badge>
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {!isExternalAdhesionInvoice ? (
                <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canEditInvoice || isUpdatingInvoice}
                onClick={handleOpenEditDialog}
              >
                <Edit3 data-icon="inline-start" />
                Editar
              </Button>

              <Button type="button" variant="outline" size="sm" onClick={handleNoopAction}>
                <Share2 className="mr-2 h-4 w-4" />
                Compartilhar fatura
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <MoreVertical className="mr-2 h-4 w-4" />
                    Mais ações
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    disabled={!invoice.invoiceUrl}
                    onSelect={(event) => {
                      event.preventDefault()
                      if (invoice.invoiceUrl) {
                        window.open(invoice.invoiceUrl, "_blank", "noopener,noreferrer")
                      }
                    }}
                  >
                    Visualizar fatura
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!hasReceipt}
                    onSelect={(event) => {
                      event.preventDefault()
                      if (hasReceipt) {
                        handleOpenReceiptModal()
                      }
                    }}
                  >
                    Ver comprovante
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {!isPaidInvoice ? (
                    <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                      Confirmar recebimento em dinheiro
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(event) => event.preventDefault()}
                  >
                    Remover cobrança
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
                </>
              ) : null}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">Cliente: {invoice.customerName}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <Separator />

          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Wallet className="h-4 w-4 text-primary" />
              Resumo financeiro
            </h2>
            <div className="grid gap-6 text-sm lg:grid-cols-2">
              <div className="space-y-2">
                <p>
                  <span className="text-muted-foreground">Valor: </span>
                  <span className="font-medium">{formatCurrency(invoice.value)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Valor líquido: </span>
                  <span className="font-medium">{formatCurrency(invoice.netValue)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Valor original: </span>
                  <span className="font-medium">{formatCurrency(invoice.originalValue)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Juros: </span>
                  <span className="font-medium">{formatCurrency(invoice.interestValue)}</span>
                </p>
                <p>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" />
                    Método de pagamento:
                  </span>{" "}
                  <span className="font-medium">
                    {BILLING_LABELS[invoice.billingType] ?? invoice.billingType}
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <p>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Data da fatura:
                  </span>{" "}
                  <span className="font-medium">{formatDate(invoice.dateCreated, tz)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Vencimento: </span>
                  <span className="font-medium">{formatDate(invoice.dueDate, tz)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Pagamento: </span>
                  <span className="font-medium">{formatDate(invoice.paymentDate, tz)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Confirmação: </span>
                  <span className="font-medium">{formatDate(invoice.confirmedDate, tz)}</span>
                </p>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Info className="h-4 w-4 text-primary" />
              Informações adicionais
            </h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Descrição: </span>
                <span className="font-medium">{invoice.description}</span>
              </p>
              <p>
                <span className="text-muted-foreground">ID da fatura: </span>
                <span className="font-mono text-xs">{invoice.id}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Referência externa: </span>
                <span className="font-medium">{invoice.externalReference ?? "—"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Parcela: </span>
                <span className="font-medium">{invoice.installmentNumber ?? "—"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Linha excluída no Asaas: </span>
                <span className="font-medium">{invoice.deleted ? "Sim" : "Não"}</span>
              </p>
              {invoice.bankSlipUrl ? (
                <p>
                  <span className="text-muted-foreground">Boleto: </span>
                  <a
                    href={invoice.bankSlipUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Abrir boleto
                  </a>
                </p>
              ) : null}
            </div>
          </section>

          {canSendNotification ? (
            <>
              <Separator />
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    void handleSendStatusNotification()
                  }}
                  disabled={isSendingNotification}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {isSendingNotification ? "Enviando..." : notificationLabel}
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {hasReceipt ? (
        <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
          <DialogContent className="h-[90vh] w-[95vw] max-w-[1200px] p-0">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-primary" />
                Comprovante da fatura {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : invoice.id}
              </DialogTitle>
              <DialogDescription>
                Visualização do comprovante sem sair da página.
              </DialogDescription>
            </DialogHeader>

            <div className="h-[calc(90vh-96px)] w-full p-4">
              <iframe
                src={invoice.transactionReceiptUrl ?? undefined}
                title={`Modal de comprovante da fatura ${invoice.invoiceNumber ?? invoice.id}`}
                className="h-full w-full rounded-md border bg-background"
                loading="lazy"
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog
        open={isEditOpen}
        onOpenChange={(nextOpen) => {
          if (isUpdatingInvoice) return
          setIsEditOpen(nextOpen)
        }}
      >
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar cobrança</DialogTitle>
            <DialogDescription>
              Altere o valor e o vencimento da fatura pendente no Asaas.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="invoice-edit-value">Valor (R$)</FieldLabel>
                <Input
                  id="invoice-edit-value"
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step="0.01"
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  disabled={isUpdatingInvoice}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="invoice-edit-due-date">Vencimento</FieldLabel>
                <Input
                  id="invoice-edit-due-date"
                  type="date"
                  value={editDueDate}
                  onChange={(event) => setEditDueDate(event.target.value)}
                  disabled={isUpdatingInvoice}
                />
              </Field>
            </FieldGroup>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isUpdatingInvoice}
              onClick={() => setIsEditOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isUpdatingInvoice}
              onClick={() => {
                void handleSaveInvoiceEdit()
              }}
            >
              {isUpdatingInvoice ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
