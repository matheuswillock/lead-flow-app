"use client"

import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { SelfCheckoutFieldErrors, SelfCheckoutFormValues } from "../context/SelfCheckoutTypes"

const inputClassName = "max-lg:h-11"

export function SelfCheckoutBuyerFields({
  values,
  errors,
  disabled,
  onChange,
}: {
  values: SelfCheckoutFormValues
  errors: SelfCheckoutFieldErrors
  disabled: boolean
  onChange: (field: keyof SelfCheckoutFormValues, value: string) => void
}) {
  return (
    <FieldGroup className="gap-5">
      <Field data-invalid={errors.fullName ? "true" : undefined}>
        <FieldLabel htmlFor="self-checkout-full-name">Nome completo</FieldLabel>
        <Input
          id="self-checkout-full-name"
          name="fullName"
          autoComplete="name"
          value={values.fullName}
          onChange={(event) => onChange("fullName", event.target.value)}
          disabled={disabled}
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={errors.fullName ? "self-checkout-full-name-error" : undefined}
          className={inputClassName}
        />
        <FieldError id="self-checkout-full-name-error">{errors.fullName}</FieldError>
      </Field>

      <Field data-invalid={errors.email ? "true" : undefined}>
        <FieldLabel htmlFor="self-checkout-email">E-mail</FieldLabel>
        <Input
          id="self-checkout-email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={values.email}
          onChange={(event) => onChange("email", event.target.value)}
          disabled={disabled}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "self-checkout-email-error" : undefined}
          className={inputClassName}
        />
        <FieldError id="self-checkout-email-error">{errors.email}</FieldError>
      </Field>

      <Field data-invalid={errors.phone ? "true" : undefined}>
        <FieldLabel htmlFor="self-checkout-phone">Celular</FieldLabel>
        <Input
          id="self-checkout-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(11) 99999-9999"
          value={values.phone}
          onChange={(event) => onChange("phone", event.target.value)}
          disabled={disabled}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "self-checkout-phone-error" : undefined}
          className={inputClassName}
        />
        <FieldError id="self-checkout-phone-error">{errors.phone}</FieldError>
      </Field>
    </FieldGroup>
  )
}
