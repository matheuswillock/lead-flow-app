"use client"

import type { ComponentProps } from "react"

import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type {
  SelfCheckoutFieldErrors,
  SelfCheckoutFieldName,
  SelfCheckoutFormValues,
  SelfCheckoutTextFieldName,
} from "../context/SelfCheckoutTypes"

const inputClassName = "max-lg:h-11"

function TextField({
  field,
  label,
  optionalHint,
  helper,
  required = true,
  values,
  errors,
  disabled,
  onChange,
  onFieldBlur,
  ...inputProps
}: {
  field: Exclude<SelfCheckoutTextFieldName, "jobTitle" | "website">
  label: string
  optionalHint?: string
  /** Texto de apoio abaixo do campo; some quando há erro. */
  helper?: string
  /** Obrigatório por padrão: só o nome fantasia é opcional. */
  required?: boolean
  values: SelfCheckoutFormValues
  errors: SelfCheckoutFieldErrors
  disabled: boolean
  onChange: (field: SelfCheckoutTextFieldName, value: string) => void
  onFieldBlur: (field: SelfCheckoutFieldName) => void
} & Omit<ComponentProps<typeof Input>, "value" | "onChange" | "disabled" | "id" | "name">) {
  const id = `self-checkout-${field}`
  const error = errors[field as keyof SelfCheckoutFieldErrors]

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
        {optionalHint ? <span className="font-normal text-muted-foreground"> ({optionalHint})</span> : null}
      </FieldLabel>
      <Input
        id={id}
        name={field}
        value={values[field]}
        onChange={(event) => onChange(field, event.target.value)}
        onBlur={() => onFieldBlur(field)}
        disabled={disabled}
        required={required}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClassName}
        {...inputProps}
      />
      {error ? null : helper ? (
        <p role="status" className="text-xs text-muted-foreground">
          {helper}
        </p>
      ) : null}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  )
}

/**
 * Dados do comprador em uma única lista. O negócio é B2B: os dados da empresa identificam o
 * contratante e os do representante dizem apenas quem está contratando.
 */
export function SelfCheckoutBuyerFields({
  values,
  errors,
  disabled,
  onChange,
  onFieldBlur,
  isLookingUpCompany = false,
}: {
  values: SelfCheckoutFormValues
  errors: SelfCheckoutFieldErrors
  disabled: boolean
  onChange: (field: SelfCheckoutTextFieldName, value: string) => void
  onFieldBlur: (field: SelfCheckoutFieldName) => void
  isLookingUpCompany?: boolean
}) {
  const shared = { values, errors, disabled, onChange, onFieldBlur }

  return (
    <FieldGroup className="grid gap-5 sm:grid-cols-2">
      <TextField
        field="cnpj"
        label="CNPJ"
        placeholder="00.000.000/0000-00"
        inputMode="numeric"
        autoComplete="off"
        helper={isLookingUpCompany ? "Buscando os dados da empresa..." : undefined}
        {...shared}
      />
      <TextField
        field="phone"
        label="WhatsApp"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="(11) 99999-9999"
        {...shared}
      />

      <TextField
        field="companyLegalName"
        label="Razão social"
        placeholder="Razão social conforme CNPJ"
        autoComplete="organization"
        {...shared}
      />
      <TextField
        field="companyTradeName"
        label="Nome fantasia"
        optionalHint="opcional"
        required={false}
        placeholder="Nome fantasia"
        autoComplete="off"
        {...shared}
      />

      <TextField
        field="fullName"
        label="Nome completo"
        placeholder="Nome do representante legal"
        autoComplete="name"
        {...shared}
      />
      <TextField
        field="email"
        label="E-mail"
        type="email"
        placeholder="representante@empresa.com"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        {...shared}
      />
    </FieldGroup>
  )
}
