"use client"

import * as React from "react"
import { ArrowLeft, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function TeamCheckoutStep(props: {
  supabaseId: string
  teamName: string
  amount: number
  onCancel: () => void
  onComplete: () => void
}) {
  const formattedAmount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(props.amount)

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="gap-2">
            <CardTitle className="text-xl">Checkout do time</CardTitle>
            <p className="text-sm text-muted-foreground">
              Finalize o pagamento para ativar o time <strong>{props.teamName}</strong>.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-semibold text-foreground">{formattedAmount}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" onClick={props.onCancel}>
                <ArrowLeft data-icon="inline-start" />
                Voltar
              </Button>
              <Button type="button" onClick={props.onComplete}>
                <CheckCircle2 data-icon="inline-start" />
                Já paguei
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

