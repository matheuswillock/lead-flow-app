"use client"

import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDocumentInput } from "@/lib/masks"

/** Resumo do pedido já criado: empresa contratante e o demonstrativo do valor. */
export function SelfCheckoutOrderSummaryCard({
  companyName,
  cnpj,
  children,
}: {
  companyName: string
  cnpj: string
  children: ReactNode
}) {
  const cnpjDigits = cnpj.replace(/\D/g, "")

  return (
    <Card className="gap-0 py-0 shadow-sm">
      <CardHeader className="gap-1 border-b border-border px-6 py-5">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Resumo do pedido
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 px-6 py-5">
        {companyName ? (
          <div className="flex flex-col gap-0.5">
            <span className="break-words font-display text-lg font-bold text-foreground">{companyName}</span>
            {cnpjDigits.length === 14 ? (
              <span className="text-sm text-muted-foreground tabular-nums">CNPJ {formatDocumentInput(cnpjDigits)}</span>
            ) : null}
          </div>
        ) : null}
        {children}
      </CardContent>
    </Card>
  )
}
