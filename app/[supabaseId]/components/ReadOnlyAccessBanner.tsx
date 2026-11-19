"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Eye } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getPaymentRecoveryHref } from "./accountAccessRecovery"

type ReadOnlyAccessBannerProps = {
  supabaseId: string
  isBillingOwner: boolean
}

const DETAILS_ID = "read-only-banner-details"

/**
 * Aviso fixo do modo somente leitura. No celular (375px) o aviso inteiro ocupava cerca de um
 * quarto da tela: ali ficam só o título e o botão de pagamento, e o texto explicativo abre sob
 * demanda. De `sm` em diante tudo continua à mostra.
 */
export function ReadOnlyAccessBanner({ supabaseId, isBillingOwner }: ReadOnlyAccessBannerProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  return (
    <Alert data-testid="read-only-banner" className="mx-4 mt-2 w-auto max-sm:py-2">
      <Eye />
      <div className="flex items-center justify-between gap-2 max-sm:mb-3">
        <AlertTitle className="mb-0 sm:mb-1">Conta em modo somente leitura</AlertTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="read-only-banner-toggle"
          className="-my-2 h-11 shrink-0 px-2 text-xs sm:hidden"
          aria-expanded={detailsOpen}
          aria-controls={DETAILS_ID}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          {detailsOpen ? "Ocultar detalhes" : "Ver detalhes"}
          <ChevronDown className={cn("size-3.5 transition-transform", detailsOpen && "rotate-180")} />
        </Button>
      </div>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p
          data-testid="read-only-banner-details"
          id={DETAILS_ID}
          className={cn(!detailsOpen && "max-sm:hidden")}
        >
          {isBillingOwner
            ? "Há um pagamento pendente. Você só pode visualizar o CRM e a Carteira. Regularize o pagamento para voltar a usar tudo. Sem a regularização, o acesso é pausado por completo."
            : "Há um pagamento pendente nesta conta. Você só pode visualizar o CRM e a Carteira. Avise o administrador para regularizar o pagamento."}
        </p>
        {isBillingOwner ? (
          <Button asChild className="h-11 w-full shrink-0 sm:w-fit">
            <Link href={getPaymentRecoveryHref(supabaseId)}>Regularizar pagamento</Link>
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
