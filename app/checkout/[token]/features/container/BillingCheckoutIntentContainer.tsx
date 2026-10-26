"use client"

import { useBillingCheckoutIntent } from "../context/BillingCheckoutIntentContext"
import type { BillingType } from "../context/BillingCheckoutIntentTypes"

function formatCurrency(value: number | null): string {
  return value == null
    ? "Indisponível"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function BillingCheckoutIntentContainer() {
  const { details, availableMethods, selectedMethod, setSelectedMethod, loading, submitting, error, submit } =
    useBillingCheckoutIntent()
  const canChooseMethod = availableMethods.length > 1

  async function handleSubmit() {
    const checkoutUrl = await submit()
    if (checkoutUrl) window.location.assign(checkoutUrl)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
      <section className="w-full space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold">
            {details && !canChooseMethod ? "Pagamento via PIX" : "Escolha a forma de pagamento"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Plano CRM mensal. O preço é confirmado no momento do checkout.</p>
        </div>
        {loading ? <p>Carregando checkout…</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {details ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {availableMethods.map((method: BillingType) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setSelectedMethod(method)}
                  disabled={details.prices[method] == null || submitting}
                  className={`rounded-xl border p-4 text-left ${selectedMethod === method ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
                >
                  <div className="font-medium">{method === "PIX" ? "PIX" : "Cartão de crédito"}</div>
                  <div className="mt-1 text-lg font-semibold">{formatCurrency(details.prices[method])}</div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || details.prices[selectedMethod] == null}
              className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting ? "Abrindo checkout…" : "Continuar para pagamento"}
            </button>
          </>
        ) : null}
      </section>
    </main>
  )
}
