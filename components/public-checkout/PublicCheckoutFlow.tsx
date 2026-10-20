"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type {
  PublicCheckoutDetails,
  PublicCheckoutPaymentInput,
  PublicCheckoutPaymentView,
  PublicCheckoutPayerPrefill,
  PublicCheckoutStep,
} from "./publicCheckoutTypes"
import { PublicCheckoutPaymentStep } from "./PublicCheckoutPaymentStep"
import { PublicCheckoutShell } from "./PublicCheckoutShell"
import { PublicCheckoutSummaryStep } from "./PublicCheckoutSummaryStep"

const DEFAULT_ATTEMPT_DURATION_MS = 25 * 60 * 1000

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function getNowDateKey(): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date())
}

export function PublicCheckoutFlow({
  attemptStorageKey,
  attemptDurationMs = DEFAULT_ATTEMPT_DURATION_MS,
  details,
  payment,
  isLoading,
  isSubmitting,
  error,
  maxInstallments,
  prefill,
  onSubmit,
  onRefreshStatus,
  pixOnly = false,
  successDescription = "Verifique seu e-mail para os proximos passos.",
}: {
  pixOnly?: boolean
  successDescription?: string
  attemptStorageKey: string
  attemptDurationMs?: number
  details: PublicCheckoutDetails | null
  payment: PublicCheckoutPaymentView | null
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
  maxInstallments: number
  prefill: PublicCheckoutPayerPrefill
  onSubmit: (input: PublicCheckoutPaymentInput) => Promise<void>
  onRefreshStatus?: (options?: { sync?: boolean }) => Promise<void>
}) {
  const [step, setStep] = useState<PublicCheckoutStep>("summary")
  const [selectedBillingType, setSelectedBillingType] = useState<"PIX" | "CREDIT_CARD">("PIX")
  const [attemptStartedAt, setAttemptStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const previousErrorRef = useRef<string | null>(null)

  const expiresAt = useMemo(() => {
    if (!attemptStartedAt) return null
    return attemptStartedAt + attemptDurationMs
  }, [attemptStartedAt, attemptDurationMs])

  const remainingMs = expiresAt ? expiresAt - now : null
  const isExpired = remainingMs != null && remainingMs <= 0

  useEffect(() => {
    if (pixOnly) {
      setSelectedBillingType("PIX")
      return
    }
    if (details?.presetBillingType) setSelectedBillingType(details.presetBillingType)
  }, [details?.presetBillingType, pixOnly])

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.sessionStorage.getItem(attemptStorageKey)
    if (stored) {
      const parsed = Number(stored)
      if (Number.isFinite(parsed) && parsed > 0) setAttemptStartedAt(parsed)
      return
    }
    const start = Date.now()
    window.sessionStorage.setItem(attemptStorageKey, String(start))
    setAttemptStartedAt(start)
  }, [attemptStorageKey])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!error || previousErrorRef.current === error) return
    previousErrorRef.current = error
  }, [error])

  useEffect(() => {
    if (isExpired) {
      setStep("expired")
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(attemptStorageKey)
      }
    }
  }, [attemptStorageKey, isExpired])

  useEffect(() => {
    if (!payment) return
    if (payment.status === "paid") setStep("success")
  }, [payment])

  useEffect(() => {
    if (!onRefreshStatus) return
    if (isLoading || isSubmitting || isExpired) return
    if (!payment) return
    if (payment.status === "paid" || payment.status === "canceled" || payment.status === "expired") return
    if (step !== "payment") return

    void onRefreshStatus({ sync: true }).catch((refreshError) => {
      console.error("[PublicCheckoutFlow][auto-refresh]", refreshError)
    })

    const interval = setInterval(() => {
      void onRefreshStatus({ sync: true }).catch((refreshError) => {
        console.error("[PublicCheckoutFlow][auto-refresh]", refreshError)
      })
    }, 8000)

    return () => clearInterval(interval)
  }, [isExpired, isLoading, isSubmitting, onRefreshStatus, payment, step])

  const countdownLabel = remainingMs == null ? "00:00" : formatCountdown(remainingMs)

  return (
    <PublicCheckoutShell
      issuedLabel={details?.issuedLabel}
      issuedValue={details?.issuedValue || getNowDateKey()}
    >
      <div className="flex items-center justify-between gap-4">
        <Badge variant="secondary" className="gap-2">
          <Clock3 aria-hidden="true" />
          <span className="font-medium">{countdownLabel}</span>
        </Badge>
        {details ? (
          <Badge variant="outline">{selectedBillingType === "PIX" ? "PIX" : "Cartao"}</Badge>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Checkout indisponivel</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {!isLoading && details && step === "summary" ? (
        <PublicCheckoutSummaryStep
          details={details}
          onFinalize={() => setStep("payment")}
          isLocked={Boolean(payment) || isSubmitting || isExpired}
        />
      ) : null}

      {!isLoading && details && step === "payment" ? (
        <>
          {pixOnly ? null : (
          <div className="mb-4 grid grid-cols-2 gap-3">
            {(["PIX", "CREDIT_CARD"] as const).map((method) => {
              const price = details.billingTypePrices[method]
              return (
                <button
                  key={method}
                  type="button"
                  disabled={Boolean(payment) || isSubmitting || price == null}
                  onClick={() => setSelectedBillingType(method)}
                  className={cn("rounded-lg border p-3 text-left", selectedBillingType === method && "border-primary ring-2 ring-primary/20")}
                >
                  <div className="text-sm font-medium">{method === "PIX" ? "PIX" : "Cartão de crédito"}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price.total)}
                  </div>
                </button>
              )
            })}
          </div>
          )}
          <PublicCheckoutPaymentStep
            pixOnly={pixOnly}
            details={details}
            billingType={selectedBillingType}
            prefill={prefill}
            maxInstallments={selectedBillingType === "PIX" ? 1 : maxInstallments}
            isSubmitting={isSubmitting}
            payment={payment}
            onSubmit={onSubmit}
            onRefreshStatus={onRefreshStatus}
          />
        </>
      ) : null}

      {!isLoading && step === "expired" ? (
        <Alert>
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Tempo expirado</AlertTitle>
          <AlertDescription>
            O link expirou. Solicite um novo checkout com o suporte.
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && step === "success" ? (
        <div className={cn("flex flex-col items-center gap-3 py-6 text-center")}>
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 aria-hidden="true" />
          </div>
          <div className="text-lg font-semibold text-foreground">Pagamento confirmado</div>
          <div className="text-sm text-muted-foreground">{successDescription}</div>
        </div>
      ) : null}
    </PublicCheckoutShell>
  )
}
