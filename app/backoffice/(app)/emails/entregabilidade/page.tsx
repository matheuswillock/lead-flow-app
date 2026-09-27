import { BackofficeDeliverabilityContainer } from "./features/container/BackofficeDeliverabilityContainer"
import { BackofficeDeliverabilityProvider } from "./features/context/BackofficeDeliverabilityContext"

export default function BackofficeDeliverabilityPage() {
  return <BackofficeDeliverabilityProvider><div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10"><BackofficeDeliverabilityContainer /></div></BackofficeDeliverabilityProvider>
}
