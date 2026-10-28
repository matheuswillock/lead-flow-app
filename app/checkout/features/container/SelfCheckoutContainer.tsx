"use client"

import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import type { FormEvent } from "react"

import { PublicCheckoutShell } from "@/components/public-checkout/PublicCheckoutShell"
import { Button } from "@/components/ui/button"
import { SelfCheckoutBuyerFields } from "../components/SelfCheckoutBuyerFields"
import { SelfCheckoutCycleSelector } from "../components/SelfCheckoutCycleSelector"
import { SelfCheckoutHoneypot } from "../components/SelfCheckoutHoneypot"
import { SelfCheckoutSkeleton } from "../components/SelfCheckoutSkeleton"
import { SelfCheckoutLoadError, SelfCheckoutUnavailable } from "../components/SelfCheckoutStateMessages"
import { SelfCheckoutSubmitFailureAlert } from "../components/SelfCheckoutSubmitFailureAlert"
import { useSelfCheckout } from "../context/SelfCheckoutHook"
import type { SelfCheckoutFieldName } from "../context/SelfCheckoutTypes"

const FIELD_ELEMENT_ID: Record<SelfCheckoutFieldName, string> = {
  cycle: "self-checkout-cycles-title",
  fullName: "self-checkout-full-name",
  email: "self-checkout-email",
  phone: "self-checkout-phone",
}

function focusField(field: SelfCheckoutFieldName) {
  const element = document.getElementById(FIELD_ELEMENT_ID[field])
  if (!element) return
  element.scrollIntoView({ block: "center" })
  if (field === "cycle") {
    document.querySelector<HTMLElement>('[role="radio"]')?.focus()
    return
  }
  element.focus()
}

function submitLabel(isSubmitting: boolean, isRedirecting: boolean): string {
  if (isRedirecting) return "Abrindo o pagamento..."
  if (isSubmitting) return "Criando seu pedido..."
  return "Continuar para o pagamento"
}

function SelfCheckoutContent() {
  const router = useRouter()
  const {
    loadStatus,
    loadErrorMessage,
    options,
    selectedCycle,
    values,
    fieldErrors,
    submitFailure,
    isSubmitting,
    isRedirecting,
    reload,
    selectCycle,
    setFieldValue,
    submit,
  } = useSelfCheckout()

  const isBusy = isSubmitting || isRedirecting

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const outcome = await submit()
    if (outcome.kind === "created") {
      router.push(`/adesao/${outcome.token}`)
    } else if (outcome.kind === "invalid") {
      focusField(outcome.firstInvalidField)
    }
  }

  if (loadStatus === "loading") return <SelfCheckoutSkeleton />
  if (loadStatus === "error" || !options) {
    return (
      <SelfCheckoutLoadError
        message={loadErrorMessage ?? "Não foi possível carregar os planos."}
        onRetry={() => void reload()}
      />
    )
  }
  if (options.cycles.length === 0) return <SelfCheckoutUnavailable />

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-semibold tracking-[0.3em] text-primary">CONTRATAÇÃO ONLINE</div>
        <h1 className="text-2xl font-semibold text-foreground">Escolha seu plano</h1>
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <span className="text-sm font-semibold text-foreground">{options.product.name}</span>
        {options.product.description ? (
          <span className="text-sm text-muted-foreground">{options.product.description}</span>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} noValidate className="relative flex flex-col gap-6">
        <SelfCheckoutCycleSelector
          cycles={options.cycles}
          value={selectedCycle}
          onChange={selectCycle}
          disabled={isBusy}
          error={fieldErrors.cycle}
        />

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">Seus dados</h2>
          <SelfCheckoutBuyerFields
            values={values}
            errors={fieldErrors}
            disabled={isBusy}
            onChange={setFieldValue}
          />
        </div>

        <SelfCheckoutHoneypot value={values.website} onChange={(next) => setFieldValue("website", next)} />

        {submitFailure ? <SelfCheckoutSubmitFailureAlert failure={submitFailure} /> : null}

        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            size="lg"
            className="w-full max-lg:min-h-11"
            disabled={isBusy}
            aria-busy={isBusy}
          >
            {isBusy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {submitLabel(isSubmitting, isRedirecting)}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Você paga por PIX na próxima etapa e recebe o acesso por e-mail.
          </p>
        </div>
      </form>
    </div>
  )
}

export function SelfCheckoutContainer() {
  return (
    <PublicCheckoutShell provider={null} issuedLabel="Vendido por" issuedValue="Corretor Studio">
      <SelfCheckoutContent />
    </PublicCheckoutShell>
  )
}
