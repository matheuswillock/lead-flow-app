import { SelfCheckoutContainer } from "./features/container/SelfCheckoutContainer"
import { SelfCheckoutProvider } from "./features/context/SelfCheckoutContext"

export const metadata = {
  title: "SelfCheckout - Corretor Studio",
  description: "Escolha seu plano, pague por PIX e receba o acesso por e-mail.",
}

export default function SelfCheckoutPage() {
  return (
    <SelfCheckoutProvider>
      <SelfCheckoutContainer />
    </SelfCheckoutProvider>
  )
}
