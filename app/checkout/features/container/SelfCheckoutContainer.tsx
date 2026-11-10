"use client"

import { ForceLightDocument } from "@/app/forms/[publicId]/features/components/ForceLightDocument"
import { PublicCheckoutShell } from "@/components/public-checkout/PublicCheckoutShell"
import { SelfCheckoutSkeleton } from "../components/SelfCheckoutSkeleton"
import { SelfCheckoutLoadError, SelfCheckoutUnavailable } from "../components/SelfCheckoutStateMessages"
import { useSelfCheckout } from "../context/SelfCheckoutHook"
import { SelfCheckoutFormContainer } from "./SelfCheckoutFormContainer"

function SelfCheckoutContent() {
  const { loadStatus, loadErrorMessage, options, reload } = useSelfCheckout()

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

  return <SelfCheckoutFormContainer />
}

export function SelfCheckoutContainer() {
  return (
    <PublicCheckoutShell
      variant="light"
      provider={null}
      issuedLabel="Vendido por"
      issuedValue="Corretor Studio"
    >
      <ForceLightDocument />
      <SelfCheckoutContent />
    </PublicCheckoutShell>
  )
}
