"use client"

import { useState } from "react"
import { Check, Loader2, Tag, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  SELF_CHECKOUT_COUPON_MAX_LENGTH,
  type SelfCheckoutCouponQuote,
} from "@/lib/self-checkout/contracts"
import { formatBRL } from "../utils/selfCheckoutForm"
import type { SelfCheckoutCouponStatus } from "../context/SelfCheckoutTypes"

/** Campo de cupom: recolhido por padrão; mostra o desconto confirmado pelo servidor quando aplicado. */
export function SelfCheckoutCoupon({
  input,
  status,
  quote,
  message,
  disabled,
  onInputChange,
  onApply,
  onRemove,
}: {
  input: string
  status: SelfCheckoutCouponStatus
  quote: SelfCheckoutCouponQuote | null
  message: string | null
  disabled: boolean
  onInputChange: (value: string) => void
  onApply: () => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const isLoading = status === "loading"

  if (status === "applied" && quote) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-semantic-success-border bg-semantic-success-surface px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Check className="size-4 shrink-0 text-semantic-success" aria-hidden />
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Badge variant="outline" className="font-mono uppercase">
                  {quote.code}
                </Badge>
                <span className="truncate">{quote.label}</span>
              </span>
              <span className="text-xs text-muted-foreground">Desconto de {formatBRL(quote.discountAmount)}</span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            onClick={onRemove}
            disabled={disabled}
            aria-label="Remover cupom"
          >
            <X aria-hidden />
          </Button>
        </div>
      </div>
    )
  }

  if (!open && !input && !message) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
      >
        <Tag className="size-4" aria-hidden />
        Tem um cupom de desconto?
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="self-checkout-coupon" className="text-sm font-semibold text-foreground">
        Cupom de desconto
      </label>
      <div className="flex items-start gap-2">
        <Input
          id="self-checkout-coupon"
          name="coupon"
          autoFocus={open}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={SELF_CHECKOUT_COUPON_MAX_LENGTH}
          placeholder="Digite o código"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter no campo aplica o cupom, nunca envia o pedido.
            if (event.key === "Enter") {
              event.preventDefault()
              onApply()
            }
          }}
          disabled={disabled || isLoading}
          aria-invalid={status === "error"}
          aria-describedby={message ? "self-checkout-coupon-message" : undefined}
          className="max-lg:h-11 uppercase"
        />
        <Button
          type="button"
          variant="outline"
          className="max-lg:min-h-11"
          onClick={onApply}
          disabled={disabled || isLoading || !input.trim()}
          aria-busy={isLoading}
        >
          {isLoading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          Aplicar
        </Button>
      </div>
      {message ? (
        <p
          id="self-checkout-coupon-message"
          role={status === "error" ? "alert" : "status"}
          className={status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
