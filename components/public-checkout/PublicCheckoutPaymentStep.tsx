"use client"

import type { ReactNode, RefObject } from "react"

import { AbacateCardField, type AbacateCardFieldHandle } from "@/app/adesao/[token]/features/components/AbacateCardField"
import { CheckoutInstallmentsSelect } from "@/components/checkout/CheckoutInstallmentsSelect"
import { Badge } from "@/components/ui/badge"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { formatDocumentInput, maskCEP, maskPhone, unmask } from "@/lib/masks"
import { formatBRL } from "@/app/adesao/[token]/features/utils/adhesionPayment"
import type { PaymentFieldErrors, PaymentFieldName } from "./publicCheckoutPhases"
import type { PublicCheckoutPayerPrefill } from "./publicCheckoutTypes"

/** id do campo na página; o checkout usa para levar o foco ao primeiro erro. */
export const publicCheckoutFieldId = (field: PaymentFieldName) => `public-checkout-${field}`

function PaymentField({
  field,
  label,
  error,
  hint,
  required = true,
  children,
}: {
  field: PaymentFieldName | "complement"
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  const id = field === "complement" ? "public-checkout-complement" : publicCheckoutFieldId(field)
  return (
    <Field data-invalid={error ? "true" : undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            {" "}
            *
          </span>
        ) : null}
        {hint ? <span className="font-normal text-muted-foreground"> ({hint})</span> : null}
      </FieldLabel>
      {children}
      <FieldError>{error}</FieldError>
    </Field>
  )
}

/**
 * Dados do pagador da fase Pagamento. Os campos ficam no formulário da página; o cartão entra
 * como `children`, pelo campo seguro do Abacate Pay.
 */
export function PublicCheckoutPaymentStep({
  form,
  errors,
  disabled,
  addressLocked,
  showAddress,
  onFieldChange,
  children,
}: {
  form: PublicCheckoutPayerPrefill
  errors: PaymentFieldErrors
  disabled: boolean
  /** Endereço só libera depois que o CEP é resolvido. */
  addressLocked: boolean
  showAddress: boolean
  onFieldChange: (field: keyof PublicCheckoutPayerPrefill, value: string) => void
  children?: ReactNode
}) {
  const inputProps = { disabled, className: "max-lg:h-11" }

  return (
    <section aria-labelledby="public-checkout-payment-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 id="public-checkout-payment-title" className="font-display text-xl leading-snug font-bold tracking-[-0.02em] text-foreground">
          Seus dados
        </h2>
        <p className="text-sm text-muted-foreground">Campos marcados com * são obrigatórios.</p>
      </div>

      <FieldGroup className="flex flex-col gap-5">
        <PaymentField field="fullName" label="Nome completo" error={errors.fullName}>
          <Input
            id={publicCheckoutFieldId("fullName")}
            name="fullName"
            autoComplete="name"
            value={form.fullName}
            onChange={(event) => onFieldChange("fullName", event.target.value)}
            aria-invalid={Boolean(errors.fullName)}
            {...inputProps}
          />
        </PaymentField>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <PaymentField field="email" label="E-mail" error={errors.email}>
            <Input
              id={publicCheckoutFieldId("email")}
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => onFieldChange("email", event.target.value)}
              aria-invalid={Boolean(errors.email)}
              {...inputProps}
            />
          </PaymentField>
          <PaymentField field="phone" label="Telefone" error={errors.phone}>
            <Input
              id={publicCheckoutFieldId("phone")}
              name="phone"
              inputMode="tel"
              autoComplete="tel"
              value={maskPhone(form.phone)}
              onChange={(event) => onFieldChange("phone", unmask(maskPhone(event.target.value)))}
              aria-invalid={Boolean(errors.phone)}
              {...inputProps}
            />
          </PaymentField>
        </div>

        <PaymentField field="cpfCnpj" label="CPF ou CNPJ" error={errors.cpfCnpj}>
          <Input
            id={publicCheckoutFieldId("cpfCnpj")}
            name="cpfCnpj"
            inputMode="numeric"
            value={formatDocumentInput(form.cpfCnpj)}
            onChange={(event) => onFieldChange("cpfCnpj", unmask(formatDocumentInput(event.target.value)))}
            aria-invalid={Boolean(errors.cpfCnpj)}
            {...inputProps}
          />
        </PaymentField>

        {showAddress ? (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <PaymentField field="postalCode" label="CEP" error={errors.postalCode}>
                <Input
                  id={publicCheckoutFieldId("postalCode")}
                  name="postalCode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={maskCEP(form.postalCode)}
                  onChange={(event) => onFieldChange("postalCode", unmask(maskCEP(event.target.value)))}
                  aria-invalid={Boolean(errors.postalCode)}
                  {...inputProps}
                />
              </PaymentField>
              <PaymentField field="addressNumber" label="Número" error={errors.addressNumber}>
                <Input
                  id={publicCheckoutFieldId("addressNumber")}
                  name="addressNumber"
                  value={form.addressNumber}
                  onChange={(event) => onFieldChange("addressNumber", event.target.value)}
                  aria-invalid={Boolean(errors.addressNumber)}
                  {...inputProps}
                  disabled={disabled || addressLocked}
                />
              </PaymentField>
            </div>

            <PaymentField field="address" label="Endereço" error={errors.address}>
              <Input
                id={publicCheckoutFieldId("address")}
                name="address"
                value={form.address}
                onChange={(event) => onFieldChange("address", event.target.value)}
                aria-invalid={Boolean(errors.address)}
                {...inputProps}
                disabled={disabled || addressLocked}
              />
            </PaymentField>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <PaymentField field="neighborhood" label="Bairro" error={errors.neighborhood}>
                <Input
                  id={publicCheckoutFieldId("neighborhood")}
                  name="neighborhood"
                  value={form.neighborhood}
                  onChange={(event) => onFieldChange("neighborhood", event.target.value)}
                  aria-invalid={Boolean(errors.neighborhood)}
                  {...inputProps}
                  disabled={disabled || addressLocked}
                />
              </PaymentField>
              <PaymentField field="complement" label="Complemento" required={false} hint="Opcional">
                <Input
                  id="public-checkout-complement"
                  name="complement"
                  value={form.complement}
                  onChange={(event) => onFieldChange("complement", event.target.value)}
                  {...inputProps}
                  disabled={disabled || addressLocked}
                />
              </PaymentField>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_120px]">
              <PaymentField field="city" label="Cidade" error={errors.city}>
                <Input
                  id={publicCheckoutFieldId("city")}
                  name="city"
                  value={form.city}
                  onChange={(event) => onFieldChange("city", event.target.value)}
                  aria-invalid={Boolean(errors.city)}
                  {...inputProps}
                  disabled={disabled || addressLocked}
                />
              </PaymentField>
              <PaymentField field="state" label="UF" error={errors.state}>
                <Input
                  id={publicCheckoutFieldId("state")}
                  name="state"
                  autoComplete="address-level1"
                  maxLength={2}
                  value={form.state}
                  onChange={(event) => onFieldChange("state", event.target.value.toUpperCase().slice(0, 2))}
                  aria-invalid={Boolean(errors.state)}
                  {...inputProps}
                  disabled={disabled || addressLocked}
                />
              </PaymentField>
            </div>
          </>
        ) : null}
      </FieldGroup>

      {children}
    </section>
  )
}

/**
 * Dados do cartão: o número, a validade e o CVV ficam só no campo seguro do Abacate Pay (iframe).
 * Aqui entram apenas o formulário seguro e as parcelas.
 */
export function PublicCheckoutCardSection({
  publicKey,
  amountInCents,
  cardFieldRef,
  error,
  disabled,
  total,
  maxInstallments,
  installments,
  onInstallmentsChange,
  installmentSchedule,
}: {
  publicKey: string
  amountInCents: number
  cardFieldRef: RefObject<AbacateCardFieldHandle | null>
  error: string | null
  disabled: boolean
  total: number
  maxInstallments: number
  installments: number
  onInstallmentsChange: (installments: number) => void
  /** Cronograma fixo do contrato: mostra as parcelas, sem escolha. */
  installmentSchedule?: number[] | null
}) {
  return (
    <section aria-labelledby="public-checkout-card-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="public-checkout-card-title" className="font-display text-xl leading-snug font-bold tracking-[-0.02em] text-foreground">
          Dados do cartão
        </h2>
        <p className="text-sm text-muted-foreground">Crédito Visa ou Mastercard. O banco pode pedir uma confirmação no app.</p>
      </div>

      <AbacateCardField ref={cardFieldRef} publicKey={publicKey} amountInCents={amountInCents} />

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {installmentSchedule && installmentSchedule.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Parcelas do contrato</span>
          <div className="flex flex-wrap gap-2">
            {installmentSchedule.map((amount, index) => (
              <Badge key={`${index}-${amount}`} variant="secondary">
                {index + 1}ª: {formatBRL(amount)}
              </Badge>
            ))}
          </div>
        </div>
      ) : maxInstallments > 1 ? (
        <CheckoutInstallmentsSelect
          total={total}
          maxInstallments={maxInstallments}
          value={installments}
          disabled={disabled}
          onChange={onInstallmentsChange}
        />
      ) : null}
    </section>
  )
}
