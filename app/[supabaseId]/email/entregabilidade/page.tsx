import { DeliverabilityDashboardContainer } from "./features/container/DeliverabilityDashboardContainer"
import { DeliverabilityProvider } from "./features/context/DeliverabilityContext"

export default function EmailDeliverabilityPage() {
  return <DeliverabilityProvider><div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10"><DeliverabilityDashboardContainer /></div></DeliverabilityProvider>
}
