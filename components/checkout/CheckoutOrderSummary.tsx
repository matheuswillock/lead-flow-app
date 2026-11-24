import type { ReactNode } from "react"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Card "Resumo do pedido" do kit. `header` (opcional) é a identificação de quem contrata; `children`
 * são as linhas de valor; `footer` fica separado por uma borda, para termos e ação. Não calcula
 * nada: quem chama passa os valores.
 */
export function CheckoutOrderSummary({
  header,
  children,
  footer,
}: {
  header?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Card className="gap-0 py-0 shadow-sm">
      <CardHeader className="gap-1 border-b border-border px-6 py-5">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Resumo do pedido
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 px-6 py-5">
        {header}
        {children}
      </CardContent>
      {footer ? <CardFooter className="flex flex-col gap-4 border-t border-border px-6 py-5">{footer}</CardFooter> : null}
    </Card>
  )
}
