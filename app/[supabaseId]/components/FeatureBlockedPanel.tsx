import Link from "next/link"
import { RefreshCw, Users2 } from "lucide-react"

import { Button } from "@/components/ui/button"

import { getPaymentRecoveryHref } from "./accountAccessRecovery"

type FeatureBlockedPanelProps = {
  supabaseId: string
  /** Só o master com cobrança pendente vê o botão que leva à regularização. */
  offerPayment: boolean
}

export function FeatureBlockedPanel({ supabaseId, offerPayment }: FeatureBlockedPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="text-center space-y-3 max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/40">
          <Users2 className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Acesso não liberado</h2>
        <p className="text-sm text-muted-foreground">
          Esta funcionalidade não está liberada para o seu usuário no momento.
        </p>
        {offerPayment ? (
          <Button asChild className="h-11 w-full">
            <Link href={getPaymentRecoveryHref(supabaseId)}>
              <RefreshCw data-icon="inline-start" aria-hidden />
              Regularizar assinatura
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
