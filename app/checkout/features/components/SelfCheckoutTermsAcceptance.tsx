"use client"

import { Field, FieldError } from "@/components/ui/field"
import { SelfCheckoutLegalDocumentDialog } from "./SelfCheckoutLegalDocumentDialog"

/**
 * Aceite dos documentos da contratação. A caixa é nativa (com a cor da marca): o alvo de toque
 * é a linha inteira, pelo rótulo, e os links dos documentos ficam no texto.
 */
export function SelfCheckoutTermsAcceptance({
  checked,
  error,
  disabled,
  onChange,
}: {
  checked: boolean
  error?: string
  disabled: boolean
  onChange: (accepted: boolean) => void
}) {
  return (
    <Field data-invalid={error ? "true" : undefined}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="self-checkout-terms"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          aria-required="true"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "self-checkout-terms-error" : undefined}
          className="mt-[3px] size-4 shrink-0 cursor-pointer rounded accent-primary disabled:cursor-not-allowed"
        />
        <label
          htmlFor="self-checkout-terms"
          className="cursor-pointer text-sm leading-relaxed text-muted-foreground"
        >
          Declaro que li e concordo com os{" "}
          <SelfCheckoutLegalDocumentDialog documentKey="terms">Termos de Uso</SelfCheckoutLegalDocumentDialog>
          , a{" "}
          <SelfCheckoutLegalDocumentDialog documentKey="privacy">
            Política de Privacidade
          </SelfCheckoutLegalDocumentDialog>{" "}
          e a{" "}
          <SelfCheckoutLegalDocumentDialog documentKey="cookies">
            Política de Cookies
          </SelfCheckoutLegalDocumentDialog>
          .
        </label>
      </div>
      <FieldError id="self-checkout-terms-error">{error}</FieldError>
    </Field>
  )
}
