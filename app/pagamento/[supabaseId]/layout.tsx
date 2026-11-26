import type { ReactNode } from "react"

import { CheckoutAccountHeader } from "@/components/checkout/CheckoutAccountHeader"
import { NO_INDEX_METADATA } from "@/lib/metadata/policies"

export const metadata = NO_INDEX_METADATA

/** Checkout de regularização: logado, sem sidebar da conta. */
export default function PagamentoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CheckoutAccountHeader />
      <main className="flex flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
