import { PublicCheckoutShell } from "@/components/public-checkout/PublicCheckoutShell"
import { SelfCheckoutSkeleton } from "./features/components/SelfCheckoutSkeleton"

export default function SelfCheckoutLoading() {
  return (
    <PublicCheckoutShell provider={null} issuedLabel="Vendido por" issuedValue="Corretor Studio">
      <SelfCheckoutSkeleton />
    </PublicCheckoutShell>
  )
}
