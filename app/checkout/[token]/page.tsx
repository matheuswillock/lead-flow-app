import { BillingCheckoutIntentProvider } from "./features/context/BillingCheckoutIntentContext"
import { BillingCheckoutIntentContainer } from "./features/container/BillingCheckoutIntentContainer"

export default async function BillingCheckoutIntentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <BillingCheckoutIntentProvider token={token}>
      <BillingCheckoutIntentContainer />
    </BillingCheckoutIntentProvider>
  )
}
