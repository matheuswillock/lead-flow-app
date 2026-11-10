"use client"

import type { ComponentProps, ReactNode } from "react"

import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type {
  AdhesionPaymentFieldErrors,
  AdhesionPaymentFieldName,
  AdhesionPaymentFormValues,
} from "../utils/adhesionPaymentForm"
import { formatBRL, installmentAmounts } from "../utils/adhesionPayment"

const inputClassName = "max-lg:h-11"

type FieldKey = AdhesionPaymentFieldName | "complement"

export type AdhesionFieldsProps = {
  values: AdhesionPaymentFormValues
  errors: AdhesionPaymentFieldErrors
  disabled: boolean
  onChange: (field: FieldKey, value: string) => void
  onBlur: (field: AdhesionPaymentFieldName) => void
}

function TextField({
  field,
  label,
  required = true,
  hint,
  className,
  values,
  errors,
  disabled,
  onChange,
  onBlur,
  ...inputProps
}: AdhesionFieldsProps & {
  field: FieldKey
  label: string
  required?: boolean
  hint?: string
  className?: string
} & Omit<ComponentProps<typeof Input>, "value" | "onChange" | "onBlur" | "disabled" | "id" | "name">) {
  const id = `adhesion-${field}`
  const error = field === "complement" ? undefined : errors[field]

  return (
    <Field data-invalid={error ? "true" : undefined} className={className}>
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
      <Input
        id={id}
        name={field}
        value={values[field]}
        onChange={(event) => onChange(field, event.target.value)}
        onBlur={() => field !== "complement" && onBlur(field)}
        disabled={disabled}
        required={required}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClassName}
        {...inputProps}
      />
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  )
}

/** Quem está contratando: a empresa vem do pedido; aqui o representante confirma seus dados. */
export function AdhesionPayerFields(props: AdhesionFieldsProps) {
  return (
    <FieldGroup className="grid gap-5 sm:grid-cols-2">
      <TextField
        {...props}
        field="fullName"
        label="Nome completo"
        autoComplete="name"
        className="sm:col-span-2"
      />
      <TextField {...props} field="email" label="E-mail" type="email" autoComplete="email" inputMode="email" />
      <TextField {...props} field="phone" label="WhatsApp" autoComplete="tel" inputMode="tel" placeholder="(11) 99999-9999" />
    </FieldGroup>
  )
}

/** Endereço de cobrança, exigido para cartão; o CEP preenche o restante. */
export function AdhesionAddressFields(props: AdhesionFieldsProps) {
  return (
    <FieldGroup className="grid gap-5 sm:grid-cols-6">
      <TextField
        {...props}
        field="postalCode"
        label="CEP"
        autoComplete="postal-code"
        inputMode="numeric"
        placeholder="00000-000"
        className="sm:col-span-2"
      />
      <TextField
        {...props}
        field="address"
        label="Endereço"
        autoComplete="address-line1"
        className="sm:col-span-4"
      />
      <TextField
        {...props}
        field="addressNumber"
        label="Número"
        autoComplete="address-line2"
        className="sm:col-span-2"
      />
      <TextField
        {...props}
        field="complement"
        label="Complemento"
        required={false}
        hint="opcional"
        className="sm:col-span-4"
      />
      <TextField
        {...props}
        field="neighborhood"
        label="Bairro"
        className="sm:col-span-2"
      />
      <TextField {...props} field="city" label="Cidade" autoComplete="address-level2" className="sm:col-span-3" />
      <TextField
        {...props}
        field="state"
        label="UF"
        autoComplete="address-level1"
        maxLength={2}
        className="sm:col-span-1"
      />
    </FieldGroup>
  )
}

function InstallmentChoice({
  count,
  amount,
  selected,
  disabled,
  onSelect,
}: {
  count: number
  amount: number
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-h-11 items-baseline justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-primary/40",
      )}
    >
      <span className="font-semibold text-foreground tabular-nums">{count}x</span>
      <span className="text-muted-foreground tabular-nums">{formatBRL(amount)}</span>
    </button>
  )
}

/**
 * Escolha de parcelas do cartão (o total do plano é o mesmo em qualquer parcela). Os dados do
 * cartão em si ficam no formulário seguro do Abacate Pay (`AbacateCardField`).
 */
export function AdhesionInstallmentsField({
  total,
  maxInstallments,
  fixedSchedule,
  value,
  disabled,
  onChange,
}: {
  total: number
  maxInstallments: number
  /** Cronograma fixo do produto: as parcelas não são escolhidas pelo cliente. */
  fixedSchedule: number[] | null
  value: number
  disabled: boolean
  onChange: (installments: number) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <h3 id="adhesion-installments-title" className="text-sm font-semibold text-foreground">
          Parcelas
        </h3>
        {fixedSchedule && fixedSchedule.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {fixedSchedule.map((amount, index) => (
              <li key={`${index}-${amount}`} className="rounded-lg border border-border bg-card px-3 py-2">
                {index + 1}ª parcela: <span className="font-semibold text-foreground">{formatBRL(amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div
            role="radiogroup"
            aria-labelledby="adhesion-installments-title"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {Array.from({ length: maxInstallments }, (_, index) => index + 1).map((count) => (
              <InstallmentChoice
                key={count}
                count={count}
                amount={installmentAmounts(total, count)[0]}
                selected={value === count}
                disabled={disabled}
                onSelect={() => onChange(count)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function AdhesionStepHeading({
  number,
  id,
  title,
  description,
}: {
  number: number
  id: string
  title: string
  description?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-bold text-primary"
        >
          {number}
        </span>
        <h2
          id={id}
          className="font-display text-xl leading-snug font-bold tracking-[-0.02em] text-foreground"
        >
          {title}
        </h2>
      </div>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  )
}
