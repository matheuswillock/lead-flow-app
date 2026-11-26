"use client"

import type { ComponentProps } from "react"

import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type {
  AdhesionPaymentFieldErrors,
  AdhesionPaymentFieldName,
  AdhesionPaymentFormValues,
} from "../utils/adhesionPaymentForm"

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

