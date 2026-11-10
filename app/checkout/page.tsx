import { SelfCheckoutContainer } from "./features/container/SelfCheckoutContainer"
import { SelfCheckoutProvider } from "./features/context/SelfCheckoutContext"

export const metadata = {
  title: "SelfCheckout - Corretor Studio",
  description: "Contrate o Corretor Studio, pague por PIX ou cartão e receba o acesso por e-mail.",
}

export default function SelfCheckoutPage() {
  return (
    <SelfCheckoutProvider>
      <SelfCheckoutContainer />
    </SelfCheckoutProvider>
  )
}
