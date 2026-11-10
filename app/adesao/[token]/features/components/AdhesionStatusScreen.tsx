"use client"

import Link from "next/link"
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

export type AdhesionStatusKind = "paid" | "expired-order" | "expired-attempt"

function StatusPanel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">{title}</h1>
      <div className="flex flex-col items-center gap-4 text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

/** Telas de estado final do pagamento: confirmado, pedido expirado ou tempo da tentativa esgotado. */
export function AdhesionStatusScreen({
  kind,
  onResume,
}: {
  kind: AdhesionStatusKind
  onResume: () => void
}) {
  if (kind === "paid") {
    return (
      <StatusPanel icon={<CheckCircle2 className="size-7" aria-hidden />} title="Pagamento confirmado">
        <p>Verifique seu e-mail: enviamos o acesso e os próximos passos.</p>
      </StatusPanel>
    )
  }

  if (kind === "expired-order") {
    return (
      <StatusPanel icon={<AlertTriangle className="size-7" aria-hidden />} title="Este pedido expirou">
        <p>Refaça a contratação para gerar um novo pedido.</p>
        <Button asChild size="lg">
          <Link href="/checkout">Voltar à contratação</Link>
        </Button>
      </StatusPanel>
    )
  }

  return (
    <StatusPanel icon={<Clock3 className="size-7" aria-hidden />} title="O tempo para pagar acabou">
      <p>Por segurança, o pedido fica reservado por 25 minutos. Continue por aqui para retomar.</p>
      <Button type="button" size="lg" onClick={onResume}>
        Continuar pagamento
      </Button>
    </StatusPanel>
  )
}
