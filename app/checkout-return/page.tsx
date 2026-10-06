import { Suspense } from "react"

import { CheckoutReturnProvider } from "./features/context/CheckoutReturnContext"
import { CheckoutReturnContainer } from "./features/container/CheckoutReturnContainer"
import Loading from "./loading"

export default function CheckoutReturnPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CheckoutReturnProvider>
        <CheckoutReturnContainer />
      </CheckoutReturnProvider>
    </Suspense>
  )
}
