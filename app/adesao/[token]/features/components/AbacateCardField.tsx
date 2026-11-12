"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { AlertTriangle, Lock } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import {
  describeAbacateError,
  loadAbacatePay,
  type AbacateCheckout,
  type AbacateTokenizeCustomer,
  type AbacateTokenizeResult,
} from "@/lib/payment-provider/abacate-js"

export type AbacateCardFieldHandle = {
  /** Valida o cartão (com 3DS quando o banco pedir) e devolve o token de uso único. */
  tokenize(customer: AbacateTokenizeCustomer): Promise<AbacateTokenizeResult>
  readonly canTokenize: boolean
}

type LoadState = "loading" | "ready" | "error"

/**
 * Campos do cartão desenhados pelo Abacate Pay num iframe seguro. Recria o formulário quando o
 * valor muda, porque o token só vale para o valor informado na criação.
 */
export const AbacateCardField = forwardRef<
  AbacateCardFieldHandle,
  { publicKey: string; amountInCents: number; onCanTokenizeChange?: (canTokenize: boolean) => void }
>(function AbacateCardField({ publicKey, amountInCents, onCanTokenizeChange }, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const checkoutRef = useRef<AbacateCheckout | null>(null)
  const canTokenizeRef = useRef(false)
  const onChangeRef = useRef(onCanTokenizeChange)
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    onChangeRef.current = onCanTokenizeChange
  }, [onCanTokenizeChange])

  useEffect(() => {
    let cancelled = false
    const host = hostRef.current
    if (!host) return
    setLoadState("loading")
    setLoadError(null)
    canTokenizeRef.current = false
    onChangeRef.current?.(false)

    const target = document.createElement("div")
    host.appendChild(target)

    loadAbacatePay()
      .then(async (abacate) => {
        if (cancelled) return
        const checkout = abacate.create({
          publicKey,
          amount: amountInCents,
          locale: "pt",
          icons: true,
          theme: { styles: { input: { fontSize: "16px" } } },
          onCardChange: ({ canTokenize }) => {
            canTokenizeRef.current = canTokenize
            onChangeRef.current?.(canTokenize)
          },
        })
        checkoutRef.current = checkout
        await checkout.mount(target)
        if (!cancelled) setLoadState("ready")
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(describeAbacateError(error))
        setLoadState("error")
      })

    return () => {
      cancelled = true
      checkoutRef.current?.destroy()
      checkoutRef.current = null
      target.remove()
    }
  }, [publicKey, amountInCents])

  useImperativeHandle(
    ref,
    () => ({
      tokenize: (customer) => {
        const checkout = checkoutRef.current
        if (!checkout) return Promise.reject(Object.assign(new Error("not mounted"), { code: "NOT_MOUNTED" }))
        return checkout.tokenize(customer)
      },
      get canTokenize() {
        return canTokenizeRef.current
      },
    }),
    [],
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="relative min-h-[140px] rounded-xl border border-border bg-card p-3">
        {loadState === "loading" ? (
          <div className="absolute inset-3 flex flex-col gap-3" aria-hidden="true">
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </div>
        ) : null}
        <div ref={hostRef} id="adhesion-card-iframe" />
        {loadState === "error" ? (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {loadError}
          </p>
        ) : null}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        Os dados do cartão vão direto para o Abacate Pay, em ambiente seguro. Não ficam salvos conosco.
      </p>
    </div>
  )
})
