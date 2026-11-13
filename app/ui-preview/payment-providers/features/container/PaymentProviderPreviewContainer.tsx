"use client"

import { PaymentProviderInstancesContainer } from "@/app/backoffice/(app)/payment-providers/features/container/PaymentProviderInstancesContainer"
import { usePaymentProviderPreviewContext } from "../context/PaymentProviderPreviewContext"

export function PaymentProviderPreviewContainer() {
  const { notice } = usePaymentProviderPreviewContext()

  return (
    <>
      <div
        aria-label="Prévia local"
        className="mx-auto w-full max-w-6xl px-4 pt-4 lg:px-8"
        role="note"
      >
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
          {notice}
        </p>
      </div>
      <PaymentProviderInstancesContainer />
    </>
  )
}
