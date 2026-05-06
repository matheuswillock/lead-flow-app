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
}: {
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
          <Badge variant="outline">{details.presetBillingType === "PIX" ? "PIX" : "Cartao"}</Badge>
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
        <PublicCheckoutPaymentStep
          details={details}
          billingType={details.presetBillingType}
          prefill={prefill}
          maxInstallments={maxInstallments}
          isSubmitting={isSubmitting}
          payment={payment}
          onSubmit={onSubmit}
          onRefreshStatus={onRefreshStatus}
        />
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
          <div className="text-sm text-muted-foreground">Verifique seu e-mail para os proximos passos.</div>
        </div>
      ) : null}
    </PublicCheckoutShell>
  )
}
