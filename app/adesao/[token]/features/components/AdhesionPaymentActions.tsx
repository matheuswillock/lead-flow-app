"use client"

import { Loader2, Lock } from "lucide-react"

import { PixPaymentBlock } from "@/components/public-checkout/PixPaymentBlock"
import { Button } from "@/components/ui/button"
import type { PublicAdhesionPayment } from "../context/PublicAdhesionTypes"

function Waiting({ children }: { children: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {children}
    </p>
  )
}

function PixPending({
  pix,
  isExpired,
  isValidating,
  isRegenerating,
  onValidate,
  onRegenerate,
}: {
  pix: NonNullable<PublicAdhesionPayment["pix"]>
  isExpired: boolean
  isValidating: boolean
  isRegenerating: boolean
  onValidate: () => void
  onRegenerate: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <PixPaymentBlock payload={pix.payload} encodedImage={pix.encodedImage} expirationDate={pix.expirationDate} />
      {isExpired ? (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            Este PIX expirou. Gere um novo PIX para pagar.
          </p>
          <Button type="button" size="lg" className="max-lg:min-h-11" onClick={onRegenerate} disabled={isRegenerating}>
            {isRegenerating ? "Gerando..." : "Gerar novo PIX"}
          </Button>
        </>
      ) : (
        <>
          <Waiting>Aguardando a confirmação do pagamento.</Waiting>
          <Button type="button" variant="outline" className="max-lg:min-h-11" onClick={onValidate} disabled={isValidating}>
            {isValidating ? "Validando..." : "Já paguei, validar"}
          </Button>
        </>
      )}
    </div>
  )
}

function submitLabel(isSubmitting: boolean, isCard: boolean): string {
  if (isSubmitting) return isCard ? "Processando o pagamento..." : "Gerando o QR Code..."
  return isCard ? "Pagar com cartão" : "Gerar QR Code PIX"
}

/**
 * Área de ação abaixo do total: botão de pagar antes da cobrança, QR Code do PIX depois dela, ou o
 * aviso de análise quando o pagamento (cartão) já foi enviado.
 */
export function AdhesionPaymentActions({
  payment,
  hasPayment,
  isCard,
  isSubmitting,
  isLocked,
  isResolvingCep,
  pixExpired,
  isValidating,
  isRegenerating,
  onValidate,
  onRegenerate,
}: {
  payment: PublicAdhesionPayment | null
  hasPayment: boolean
  isCard: boolean
  isSubmitting: boolean
  isLocked: boolean
  isResolvingCep: boolean
  pixExpired: boolean
  isValidating: boolean
  isRegenerating: boolean
  onValidate: () => void
  onRegenerate: () => void
}) {
  if (payment?.pix) {
    return (
      <PixPending
        pix={payment.pix}
        isExpired={pixExpired}
        isValidating={isValidating}
        isRegenerating={isRegenerating}
        onValidate={onValidate}
        onRegenerate={onRegenerate}
      />
    )
  }

  if (hasPayment) {
    return (
      <div className="flex flex-col gap-3">
        <Waiting>Pagamento em análise. Atualizamos esta tela assim que for confirmado.</Waiting>
        {payment?.invoiceUrl ? (
          <Button asChild variant="outline" className="max-lg:min-h-11">
            <a href={payment.invoiceUrl} target="_blank" rel="noopener noreferrer">
              Ver fatura
            </a>
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="submit"
        size="lg"
        className="w-full max-lg:min-h-11"
        disabled={isLocked || isResolvingCep}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
        {submitLabel(isSubmitting, isCard)}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        {isCard
          ? "Seus dados do cartão são enviados com segurança e não ficam salvos conosco."
          : "O QR Code vale por tempo limitado. O acesso chega por e-mail após a confirmação."}
      </p>
    </div>
  )
}
