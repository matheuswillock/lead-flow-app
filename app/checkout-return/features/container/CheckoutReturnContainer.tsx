"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCheckoutReturn } from "../context/CheckoutReturnHook";

export function CheckoutReturnContainer() {
  const { state, goToLogin } = useCheckoutReturn();

  if (state.status === "confirmed") {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <CheckCircle2 className="size-16 text-success" />
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">Pagamento confirmado</h1>
          <p className="text-sm text-muted-foreground">
            Recebemos a confirmação do seu pagamento. Acesse sua conta para continuar.
          </p>
        </div>
        <Button onClick={goToLogin} size="lg" className="h-11">
          Ir para o login
        </Button>
      </main>
    );
  }

  if (state.status === "checking") {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <Loader2 className="size-16 animate-spin text-primary motion-reduce:animate-none" />
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">Recebemos seu retorno</h1>
          <p className="text-sm text-muted-foreground">Estamos confirmando o seu pagamento.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Ainda estamos confirmando o seu pagamento</h1>
        <p className="text-sm text-muted-foreground">
          Você pode fechar esta página — avisaremos por e-mail assim que o pagamento for confirmado.
        </p>
      </div>
      <Button onClick={goToLogin} variant="outline" size="lg" className="h-11">
        Ir para o login
      </Button>
    </main>
  );
}
