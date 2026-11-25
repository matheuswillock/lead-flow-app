"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { AlertCircle, Plus, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBackofficePayments } from "../context/BackofficePaymentsContext"
import type {
  BackofficeCardCheckout,
  CreatePaymentFormData,
} from "../services/IBackofficePaymentsService"
import { CardTokenizationField } from "@/components/payments/CardTokenizationField"
import { useCardTokenization } from "@/components/payments/useCardTokenization"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone, parseDateKeyToUtc } from "@/lib/dates"
import { toastUserError } from "@/lib/ui/to-user-toast-message"
import { applyPhoneInput, maskPhone, registrationPhoneError } from "@/lib/masks"

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pendente", variant: "outline" },
  AWAITING_RISK_ANALYSIS: { label: "Em análise", variant: "outline" },
  RECEIVED: { label: "Recebido", variant: "default" },
  CONFIRMED: { label: "Confirmado", variant: "default" },
  OVERDUE: { label: "Vencido", variant: "destructive" },
  REFUNDED: { label: "Reembolsado", variant: "secondary" },
  CANCELED: { label: "Cancelado", variant: "secondary" },
  FAILED: { label: "Recusado", variant: "destructive" },
}

// Boleto continua aqui para as cobranças antigas; novas cobranças só saem em PIX ou cartão.
const BILLING_LABELS: Record<string, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão",
  UNDEFINED: "A definir",
}

const NO_CARD_CHECKOUT: BackofficeCardCheckout = { cardOffered: false, provider: null, publicKey: null }

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value)
  )
}

function formatDate(value: string | null, tz: string) {
  if (!value) return "—"
  // A API serializa dueDate como ISO completo; parseDateKeyToUtc espera só YYYY-MM-DD.
  return formatIntimezone(parseDateKeyToUtc(value.slice(0, 10), tz), "dd/MM/yyyy", tz)
}

const digitsOnly = (value: string) => value.replace(/\D/g, "")
const isValidDocument = (digits: string) => digits.length === 11 || digits.length === 14

interface PixDialogProps {
  open: boolean
  onClose: () => void
  pixQrCode: string | null
  pixPayload: string | null
}

function PixDialog({ open, onClose, pixQrCode, pixPayload }: PixDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code PIX</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          {pixQrCode && (
            <img
              src={`data:image/png;base64,${pixQrCode}`}
              alt="QR Code PIX"
              className="w-48 h-48"
            />
          )}
          {pixPayload && (
            <div className="w-full space-y-2">
              <Label>Copia e Cola</Label>
              <Input value={pixPayload} readOnly className="text-xs" />
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(pixPayload)
                  toast.success("Código copiado!")
                }}
              >
                Copiar código
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const initialForm: CreatePaymentFormData = {
  clientId: "",
  billingType: "PIX",
  amount: 0,
  dueDate: "",
  description: "",
  cpfCnpj: "",
  phone: "",
}

export function BackofficePaymentsContainer() {
  const {
    payments,
    clients,
    isLoading,
    isCreating,
    error,
    canManage,
    createPayment,
    fetchPayments,
    loadCardCheckout,
  } = useBackofficePayments()
  const { tz } = useTimezone()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CreatePaymentFormData>(initialForm)
  const [cardCheckout, setCardCheckout] = useState<BackofficeCardCheckout>(NO_CARD_CHECKOUT)
  const cardTokenization = useCardTokenization(cardCheckout.provider)
  const [pixDialog, setPixDialog] = useState<{
    open: boolean
    pixQrCode: string | null
    pixPayload: string | null
  }>({ open: false, pixQrCode: null, pixPayload: null })
  const [phoneAttempted, setPhoneAttempted] = useState(false)
  const submitLock = useRef(false)
  const phoneInputRef = useRef<HTMLInputElement>(null)

  const selectedClient = clients.find((c) => c.id === form.clientId) ?? null
  const needsDocument = Boolean(selectedClient) && !selectedClient?.cpfCnpj
  const needsPhone = Boolean(selectedClient) && !digitsOnly(selectedClient?.phone ?? "")
  const phoneError = needsPhone && phoneAttempted ? registrationPhoneError(form.phone) : null
  // Cartão indisponível nunca fica selecionado nem é enviado.
  const effectiveBillingType =
    form.billingType === "CREDIT_CARD" && !cardCheckout.cardOffered ? "PIX" : form.billingType
  const isCard = effectiveBillingType === "CREDIT_CARD"
  const amountNumber = Number(form.amount) || 0
  const amountInCents = Math.round(amountNumber * 100)

  useEffect(() => {
    if (!open) return
    let active = true
    loadCardCheckout()
      .then((data) => {
        if (active) setCardCheckout(data)
      })
      .catch(() => {
        if (active) setCardCheckout(NO_CARD_CHECKOUT)
      })
    return () => {
      active = false
    }
  }, [open, loadCardCheckout])

  function handleChange(field: keyof CreatePaymentFormData, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleClientChange(clientId: string) {
    // Documento e telefone digitados valiam para o cliente anterior.
    setForm((prev) => ({ ...prev, clientId, cpfCnpj: "", phone: "" }))
    setPhoneAttempted(false)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setForm(initialForm)
      setPhoneAttempted(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitLock.current) return
    if (!form.clientId || !selectedClient) {
      toast.error("Selecione um cliente")
      return
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Valor deve ser maior que zero")
      return
    }
    const document = digitsOnly(form.cpfCnpj ?? "")
    if (needsDocument && !isValidDocument(document)) {
      toast.error("Informe um CPF ou CNPJ válido para o cliente")
      return
    }
    if (needsPhone && registrationPhoneError(form.phone)) {
      setPhoneAttempted(true)
      phoneInputRef.current?.focus()
      return
    }
    if (!selectedClient.email) {
      toast.error("Cadastre o e-mail do cliente antes de cobrar")
      return
    }

    submitLock.current = true
    try {
      let cardToken: string | undefined
      if (isCard) {
        const token = await cardTokenization.tokenizeCard({
          fullName: selectedClient.fullName,
          email: selectedClient.email,
          cnpj: needsDocument ? document : (selectedClient.cpfCnpj ?? ""),
          phone: needsPhone ? (form.phone ?? "") : (selectedClient.phone ?? ""),
        })
        if (!token) return
        cardToken = token
      }

      const created = await createPayment({
        clientId: form.clientId,
        billingType: effectiveBillingType,
        amount: Number(form.amount),
        dueDate: form.dueDate || undefined,
        description: form.description || undefined,
        cpfCnpj: needsDocument ? document : undefined,
        phone: needsPhone ? form.phone : undefined,
        cardToken,
      })
      toast.success("Cobrança criada com sucesso")
      setOpen(false)
      setForm(initialForm)

      if (effectiveBillingType === "PIX" && created.pixQrCode) {
        setPixDialog({
          open: true,
          pixQrCode: created.pixQrCode,
          pixPayload: created.pixPayload ?? null,
        })
      }
    } catch (err) {
      // `toastUserError` só manda para o console o que NÃO é ApiRequestError.
      // Rejeição 4xx de negócio (cliente sem CPF, valor inválido, cartão
      // recusado) é resultado esperado, não erro de sistema.
      toastUserError(err)
    } finally {
      submitLock.current = false
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pagamentos</h1>
        {canManage && (
          <Button size="sm" className="max-lg:h-11" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Cobrança
          </Button>
        )}
      </div>

      {/*
        `Alert` do shadcn em vez de div própria: ele já traz `role="alert"`,
        então o leitor de tela anuncia a falha de carregamento, que chega de
        forma assíncrona depois da página montada.
      */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <Button
              size="sm"
              variant="outline"
              className="max-lg:h-11"
              onClick={() => fetchPayments()}
            >
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Pagamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : payments.length === 0 && !error ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma cobrança encontrada
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => {
                const client = clients.find((c) => c.id === payment.clientId)
                const statusInfo = STATUS_LABELS[payment.status] ?? { label: payment.status, variant: "outline" as const }
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{client?.fullName ?? "—"}</TableCell>
                    <TableCell>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>{BILLING_LABELS[payment.billingType] ?? payment.billingType}</TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(payment.dueDate, tz)}</TableCell>
                    <TableCell>
                      {payment.invoiceUrl ? (
                        <a
                          href={payment.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary text-xs hover:underline"
                        >
                          Ver <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : payment.status === "PENDING" && payment.pixPayload ? (
                        // O provedor não devolve URL de pagamento para PIX: o operador envia o copia e cola.
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs max-lg:h-11 max-lg:min-w-11"
                          onClick={() =>
                            setPixDialog({
                              open: true,
                              pixQrCode: payment.pixQrCode,
                              pixPayload: payment.pixPayload,
                            })
                          }
                        >
                          Ver PIX
                        </Button>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Cobrança</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select
                value={form.clientId}
                onValueChange={handleClientChange}
              >
                <SelectTrigger className="max-lg:h-11">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsDocument && (
              <div className="space-y-2">
                <Label htmlFor="cpfCnpj">CPF ou CNPJ do cliente *</Label>
                <Input
                  id="cpfCnpj"
                  inputMode="numeric"
                  autoComplete="off"
                  className="max-lg:h-11"
                  maxLength={18}
                  value={form.cpfCnpj ?? ""}
                  onChange={(e) => handleChange("cpfCnpj", e.target.value)}
                  placeholder="000.000.000-00"
                  aria-describedby="cpfCnpj-help"
                  required
                />
                <p id="cpfCnpj-help" className="text-xs text-muted-foreground">
                  Este cliente não tem CPF ou CNPJ cadastrado. O documento será salvo no cadastro.
                </p>
              </div>
            )}
            {needsPhone && (
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone do cliente *</Label>
                <Input
                  ref={phoneInputRef}
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  // É o telefone de outra pessoa: o autopreenchimento colocaria o de quem está logado.
                  autoComplete="off"
                  className="max-lg:h-11"
                  value={maskPhone(form.phone ?? "")}
                  onChange={(e) =>
                    handleChange(
                      "phone",
                      applyPhoneInput(
                        form.phone ?? "",
                        e.target.value,
                        (e.nativeEvent as InputEvent).inputType === "insertText"
                      )
                    )
                  }
                  onBlur={() => setPhoneAttempted(true)}
                  placeholder="(11) 99999-9999"
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={phoneError ? "phone-error" : "phone-help"}
                />
                {phoneError ? (
                  <p id="phone-error" role="alert" className="text-xs text-destructive">
                    {phoneError}
                  </p>
                ) : (
                  <p id="phone-help" className="text-xs text-muted-foreground">
                    Este cliente não tem telefone cadastrado. O número será salvo no cadastro.
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Tipo de cobrança</Label>
              <Select
                value={effectiveBillingType}
                onValueChange={(v) => handleChange("billingType", v)}
              >
                <SelectTrigger className="max-lg:h-11">
                  <SelectValue />
</SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  {cardCheckout.cardOffered && <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="number"
                className="max-lg:h-11"
                min="0.01"
                step="0.01"
                value={form.amount || ""}
                onChange={(e) => handleChange("amount", e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            {isCard && (
              <div className="space-y-2">
                <Label>Dados do cartão *</Label>
                {cardCheckout.publicKey && amountInCents >= 100 ? (
                  <CardTokenizationField
                    ref={cardTokenization.cardFieldRef}
                    provider={cardCheckout.provider}
                    publicKey={cardCheckout.publicKey}
                    amountInCents={amountInCents}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Informe o valor (mínimo R$ 1,00) para carregar o formulário do cartão.
                  </p>
                )}
                {cardTokenization.cardError && (
                  <p role="alert" className="text-xs text-destructive">
                    {cardTokenization.cardError}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Vencimento</Label>
              <Input
                id="dueDate"
                type="date"
                className="max-lg:h-11"
                value={form.dueDate}
                onChange={(e) => handleChange("dueDate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                className="max-lg:h-11"
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Descrição opcional"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="max-lg:h-11"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="max-lg:h-11" disabled={isCreating || cardTokenization.isTokenizing}>
                {cardTokenization.isTokenizing
                  ? "Validando cartão..."
                  : isCreating
                    ? "Criando..."
                    : "Criar Cobrança"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PixDialog
        open={pixDialog.open}
        onClose={() => setPixDialog((s) => ({ ...s, open: false }))}
        pixQrCode={pixDialog.pixQrCode}
        pixPayload={pixDialog.pixPayload}
      />
    </div>
  )
}
