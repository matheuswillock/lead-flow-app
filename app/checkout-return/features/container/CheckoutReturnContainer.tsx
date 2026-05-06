"use client"

import { useCheckoutReturn } from "../context/CheckoutReturnHook"

export function CheckoutReturnContainer() {
  useCheckoutReturn()

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col justify-center gap-2 px-6 py-10">
      <h1 className="text-xl font-semibold">Pagamento confirmado</h1>
      <p className="text-sm text-muted-foreground">Redirecionando para o login...</p>
    </main>
  )
}

