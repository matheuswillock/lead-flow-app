"use client"

import { Bug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSentryExamplePageContext } from "../context/SentryExamplePageContext"

export function SentryExamplePageContainer() {
  const { errorMessage, eventId, isTriggering, triggerExampleError } =
    useSentryExamplePageContext()

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-16">
      <section className="flex w-full max-w-2xl flex-col gap-6 rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bug />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Teste do Sentry</h1>
            <p className="text-sm text-muted-foreground">
              Esta página existe apenas para disparar um evento controlado e validar a captura no Sentry.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Abra o projeto no Sentry e clique no botão abaixo. A página envia uma exceção real para o
          Sentry, faz `flush` e mostra o `eventId` quando o envio termina.
        </div>

        {eventId ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
            Evento enviado com sucesso. `eventId`: {eventId}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={isTriggering}
            onClick={async () => {
              await triggerExampleError({ message: errorMessage })
            }}
          >
            <Bug data-icon="inline-start" />
            {isTriggering ? "Enviando erro..." : "Disparar erro de teste"}
          </Button>
        </div>
      </section>
    </main>
  )
}
