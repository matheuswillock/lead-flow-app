'use client';

import { useEffect } from "react";
import { useBillingGracePaymentContext } from "../context/BillingGracePaymentContext";
import { Button } from "@/components/ui/button"
import { PixPaymentBlock } from "@/components/public-checkout/PixPaymentBlock"

export function BillingGracePaymentContainer() {
  const { isLoading, error, quote, payment, load, createPayment } = useBillingGracePaymentContext();

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (payment) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold">Pagamento PIX</h1>
        <p className="text-muted-foreground">Status: {payment.status}</p>
        {payment.paymentInstructions?.brCode && (
          <PixPaymentBlock
            payload={payment.paymentInstructions.brCode}
            encodedImage={payment.paymentInstructions.brCodeBase64}
            expirationDate={payment.paymentInstructions.expiresAt}
          />
        )}
        {payment.status === "completed" && <p className="text-semantic-success">Pagamento confirmado. O acesso será atualizado.</p>}
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Regularizar pagamento</h1>
        <p className="text-muted-foreground">Pague via PIX para recuperar o acesso completo.</p>
      </div>
      {quote && <p className="text-lg font-medium">Valor: {(quote.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}
      <Button type="button" onClick={() => void createPayment()} disabled={isLoading || !quote}>
        Gerar PIX
      </Button>
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </main>
  )
}
