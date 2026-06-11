"use client"

import { Loader2, QrCode } from "lucide-react"
import { toast } from "sonner"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { CepService } from "@/lib/services/CepService"
import { maskCEP, maskCardNumber, maskPhone, formatDocumentInput, unmask } from "@/lib/masks"
import { cn } from "@/lib/utils"
import { Field, FieldGroup } from "./PublicCheckoutField"
import type { PublicCheckoutBillingType, PublicCheckoutDetails, PublicCheckoutPaymentInput, PublicCheckoutPaymentView, PublicCheckoutPayerPrefill } from "./publicCheckoutTypes"

function onlyDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength)
}

function initialPaymentInput(prefill: PublicCheckoutPayerPrefill): PublicCheckoutPaymentInput {
  return {
    ...prefill,
    installments: 1,
    creditCard: {
      holderName: "",
      number: "",
      expiryMonth: "",
      expiryYear: "",
      ccv: "",
    },
  }
}

const checkoutInputClassName =
  "disabled:opacity-100 disabled:bg-muted/30 disabled:text-foreground/70 disabled:border-input"

export function PublicCheckoutPaymentStep({
  details,
  billingType,
  prefill,
  maxInstallments,
  isSubmitting,
  payment,
  onSubmit,
  onRefreshStatus,
}: {
  details: PublicCheckoutDetails
  billingType: PublicCheckoutBillingType
  prefill: PublicCheckoutPayerPrefill
  maxInstallments: number
  isSubmitting: boolean
  payment: PublicCheckoutPaymentView | null
  onSubmit: (input: PublicCheckoutPaymentInput) => Promise<void>
  onRefreshStatus?: (options?: { sync?: boolean }) => Promise<void>
}) {
  const [form, setForm] = useState<PublicCheckoutPaymentInput>(() => initialPaymentInput(prefill))
  const [isValidatingPayment, setIsValidatingPayment] = useState(false)
  const [isResolvingCep, setIsResolvingCep] = useState(false)
  const [cepResolved, setCepResolved] = useState(false)
  const [lastResolvedCep, setLastResolvedCep] = useState<string | null>(null)

  const hasPayment = Boolean(payment?.invoiceUrl || payment?.pix)
  const isLocked = isSubmitting || hasPayment
  const isAddressLocked = isLocked || !cepResolved

  const installmentsOptions = useMemo(() => {
    const count = Math.max(1, Math.min(12, Math.trunc(maxInstallments || 1)))
    return Array.from({ length: count }, (_, idx) => idx + 1)
  }, [maxInstallments])

  function updateField<K extends keyof PublicCheckoutPaymentInput>(
    key: K,
    value: PublicCheckoutPaymentInput[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateCardField<K extends keyof PublicCheckoutPaymentInput["creditCard"]>(
    key: K,
    value: PublicCheckoutPaymentInput["creditCard"][K]
  ) {
    setForm((prev) => ({ ...prev, creditCard: { ...prev.creditCard, [key]: value } }))
  }

  async function submit() {
    if (isLocked) return

    try {
      await onSubmit({
        ...form,
        phone: onlyDigits(form.phone, 11),
        cpfCnpj: onlyDigits(form.cpfCnpj, 14),
        postalCode: onlyDigits(form.postalCode, 8),
        creditCard: {
          ...form.creditCard,
          number: onlyDigits(form.creditCard.number, 19),
          expiryMonth: onlyDigits(form.creditCard.expiryMonth, 2),
          expiryYear: onlyDigits(form.creditCard.expiryYear, 4),
          ccv: onlyDigits(form.creditCard.ccv, 4),
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao gerar pagamento"
      toast.error(
        message === "Endereço incompleto"
          ? "Preencha CEP, número, endereço, bairro, cidade e estado."
          : message
      )
    }
  }

  async function resolveCepIfNeeded(nextPostalCode: string) {
    const cep = onlyDigits(nextPostalCode, 8)
    if (cep.length !== 8) {
      setCepResolved(false)
      return
    }

    if (lastResolvedCep === cep) return

    setIsResolvingCep(true)
    try {
      const data = await CepService.consultarCep(cep)
      if (!data) {
        setCepResolved(false)
        toast.error("CEP inválido ou não encontrado.")
        return
      }

      const formatted = CepService.formatarParaFormulario(data)
      setForm((prev) => ({
        ...prev,
        postalCode: cep,
        address: formatted.address,
        neighborhood: formatted.neighborhood,
        city: formatted.city,
        state: formatted.state,
        complement: formatted.complement || prev.complement,
      }))
      setCepResolved(true)
      setLastResolvedCep(cep)
    } finally {
      setIsResolvingCep(false)
    }
  }

  useEffect(() => {
    const cep = onlyDigits(form.postalCode, 8)
    if (!cep || cep.length !== 8) return
    if (lastResolvedCep === cep) return
    void resolveCepIfNeeded(cep)
  }, [form.postalCode, lastResolvedCep])

  async function validatePayment() {
    if (!onRefreshStatus || isValidatingPayment) return
    setIsValidatingPayment(true)
    try {
      await onRefreshStatus({ sync: true })
    } finally {
      setIsValidatingPayment(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

  const normalizedInvoiceItems = details.invoiceItems.map((item) => {
    const unit = formatCurrency(item.unitAmountMonthly)
    const total = formatCurrency(item.totalAmountMonthly)
    return {
      key: `${item.title}:${item.description}`,
      title: `${item.quantity}x ${item.title}`,
      description: item.description,
      math: `${unit} × ${item.quantity} = ${total}`,
      total,
    }
  })

  const paymentPanel = (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4">
      <div className="text-sm font-semibold text-foreground">Resumo do que esta sendo faturado</div>
      <div className="flex flex-col gap-3">
        {normalizedInvoiceItems.map((item) => (
          <div key={item.key} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
              <div className="truncate text-xs text-muted-foreground">{item.description}</div>
              <div className="text-[11px] text-muted-foreground">{item.math}</div>
            </div>
            <div className="shrink-0 text-sm font-semibold text-foreground">{item.total}</div>
          </div>
        ))}
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="text-muted-foreground">Total mensal</div>
        <div className="font-semibold text-foreground">{formatCurrency(details.invoiceSummary.monthlyTotal)}</div>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="text-muted-foreground">Total</div>
        <div className="font-semibold text-foreground">{formatCurrency(details.invoiceSummary.totalDueNow)}</div>
      </div>

      {payment?.pix ? (
        <>
          <Separator />
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <QrCode aria-hidden="true" /> PIX
          </div>
          <div className="flex justify-center rounded-lg bg-white p-3 dark:bg-white">
            <img
              alt="QR Code PIX"
              className="size-44"
              src={`data:image/png;base64,${payment.pix.encodedImage}`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">
              {payment.pix.payload}
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(payment.pix!.payload)
                toast.success("Copiado.")
              }}
            >
              Copiar código PIX
            </Button>
          </div>

          {onRefreshStatus ? (
            <Button type="button" variant="secondary" onClick={validatePayment} disabled={isValidatingPayment}>
              {isValidatingPayment ? "Validando..." : "Validar pagamento"}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  )

  const isFormValid = useMemo(() => {
    const fullName = form.fullName.trim().length >= 2
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    const phone = onlyDigits(form.phone, 11).length >= 10
    const cpfCnpj = onlyDigits(form.cpfCnpj, 14).length === 11 || onlyDigits(form.cpfCnpj, 14).length === 14
    const postalCode = onlyDigits(form.postalCode, 8).length === 8

    const addressOk =
      cepResolved &&
      form.address.trim().length > 1 &&
      form.addressNumber.trim().length > 0 &&
      form.neighborhood.trim().length > 1 &&
      form.city.trim().length > 1 &&
      form.state.trim().length === 2

    if (!fullName || !email || !phone || !cpfCnpj || !postalCode || !addressOk) return false

    if (billingType === "CREDIT_CARD") {
      const cc = form.creditCard
      const holder = cc.holderName.trim().length >= 2
      const number = onlyDigits(cc.number, 19).length >= 13
      const mm = onlyDigits(cc.expiryMonth, 2).length === 2
      const yy = onlyDigits(cc.expiryYear, 4).length >= 2
      const ccv = onlyDigits(cc.ccv, 4).length >= 3
      return holder && number && mm && yy && ccv
    }

    return true
  }, [billingType, cepResolved, form])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Dados do Pagador</h2>
        <p className="text-sm text-muted-foreground">
          Confirme seus dados para finalizar o pagamento via{" "}
          {billingType === "PIX" ? "PIX" : "cartão de crédito"}.
        </p>
      </div>

      <FieldGroup>
        <Field label="Nome completo">
          <Input
            value={form.fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
            disabled={isLocked}
            className={checkoutInputClassName}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="E-mail">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              disabled={isLocked}
              className={checkoutInputClassName}
            />
          </Field>
          <Field label="Telefone">
            <Input
              value={maskPhone(form.phone)}
              onChange={(e) => updateField("phone", unmask(maskPhone(e.target.value)))}
              disabled={isLocked}
              className={checkoutInputClassName}
            />
          </Field>
        </div>

        <Field label="CPF/CNPJ">
          <Input
            value={formatDocumentInput(form.cpfCnpj)}
            onChange={(e) => updateField("cpfCnpj", unmask(formatDocumentInput(e.target.value)))}
            disabled={isLocked}
            className={checkoutInputClassName}
          />
        </Field>

      <Separator />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="CEP">
          <Input
            value={maskCEP(form.postalCode)}
            onChange={(e) => {
              const next = unmask(maskCEP(e.target.value))
              updateField("postalCode", next)
              void resolveCepIfNeeded(next)
            }}
            disabled={isLocked}
            className={checkoutInputClassName}
          />
        </Field>
        <Field label="Numero">
          <Input
            value={form.addressNumber}
            onChange={(e) => updateField("addressNumber", e.target.value)}
            disabled={isAddressLocked}
            className={checkoutInputClassName}
          />
        </Field>
      </div>

      <Field label="Endereco">
        <Input
          value={form.address}
          onChange={(e) => updateField("address", e.target.value)}
          disabled={isAddressLocked}
          className={checkoutInputClassName}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Bairro">
          <Input
            value={form.neighborhood}
            onChange={(e) => updateField("neighborhood", e.target.value)}
            disabled={isAddressLocked}
            className={checkoutInputClassName}
          />
        </Field>
        <Field label="Complemento" hint="Opcional">
          <Input
            value={form.complement}
            onChange={(e) => updateField("complement", e.target.value)}
            disabled={isAddressLocked}
            className={checkoutInputClassName}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Cidade">
          <Input
            value={form.city}
            onChange={(e) => updateField("city", e.target.value)}
            disabled={isAddressLocked}
            className={checkoutInputClassName}
          />
        </Field>
        <Field label="Estado">
          <Input
            value={form.state}
            onChange={(e) => updateField("state", e.target.value.toUpperCase().slice(0, 2))}
            disabled={isAddressLocked}
            maxLength={2}
            className={checkoutInputClassName}
          />
        </Field>
      </div>
      </FieldGroup>

      {billingType === "CREDIT_CARD" ? (
        <div className="flex flex-col gap-6">
          <Separator />
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-foreground">Cartão de crédito</h3>
            <p className="text-sm text-muted-foreground">Preencha os dados do cartão para cobrar agora.</p>
          </div>

          <FieldGroup>
            <Field label="Nome do titular">
              <Input
                value={form.creditCard.holderName}
                onChange={(e) => updateCardField("holderName", e.target.value)}
                disabled={isLocked}
                className={checkoutInputClassName}
              />
            </Field>

            <Field label="Número do cartão">
              <Input
                value={maskCardNumber(form.creditCard.number)}
                onChange={(e) => updateCardField("number", unmask(maskCardNumber(e.target.value)))}
                disabled={isLocked}
                className={checkoutInputClassName}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Mes">
                <Input
                  value={form.creditCard.expiryMonth}
                  onChange={(e) => updateCardField("expiryMonth", onlyDigits(e.target.value, 2))}
                  disabled={isLocked}
                  className={checkoutInputClassName}
                />
              </Field>
              <Field label="Ano">
                <Input
                  value={form.creditCard.expiryYear}
                  onChange={(e) => updateCardField("expiryYear", onlyDigits(e.target.value, 4))}
                  disabled={isLocked}
                  className={checkoutInputClassName}
                />
              </Field>
              <Field label="CVV">
                <Input
                  value={form.creditCard.ccv}
                  onChange={(e) => updateCardField("ccv", onlyDigits(e.target.value, 4))}
                  disabled={isLocked}
                  className={checkoutInputClassName}
                />
              </Field>
            </div>

            <Field label="Parcelas" hint={`Max: ${Math.max(1, maxInstallments)}`}>
              <div className="flex flex-wrap gap-2">
                {installmentsOptions.map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    variant={form.installments === opt ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateField("installments", opt)}
                    disabled={isLocked}
                  >
                    {opt}x
                  </Button>
                ))}
              </div>
            </Field>
          </FieldGroup>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          size="lg"
          onClick={submit}
          disabled={isLocked || isResolvingCep || !isFormValid || isSubmitting}
        >
          {isSubmitting ? (
            <>
              {billingType === "PIX" ? "Gerando pagamento..." : "Verificando pagamento..."}
              <Loader2 data-icon="inline-end" className={cn("animate-spin")} aria-hidden="true" />
            </>
          ) : (
            billingType === "PIX" ? "Gerar QR Code Pix" : "Pagar com cartão"
          )}
        </Button>
      </div>
      </div>

      <div className="flex flex-col gap-3 lg:pt-9">
        <div className="text-sm font-semibold text-foreground">Resumo da fatura</div>
        {paymentPanel}
      </div>
    </div>
  )
}
