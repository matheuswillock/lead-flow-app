"use client"

import { SelfCheckoutLegalDocumentDialog } from "@/app/checkout/features/components/SelfCheckoutLegalDocumentDialog"

/**
 * Aviso de aceite dos documentos, ao lado do botão de pagar. O aceite é implícito: quem paga concorda,
 * então não há caixa nem bloqueio de envio. Os links abrem os documentos da contratação.
 */
export function CheckoutTermsNotice() {
  return (
    <p className="text-center text-xs leading-relaxed text-muted-foreground">
      Ao pagar, você concorda com os{" "}
      <SelfCheckoutLegalDocumentDialog documentKey="terms">Termos de Uso</SelfCheckoutLegalDocumentDialog>, a{" "}
      <SelfCheckoutLegalDocumentDialog documentKey="privacy">Política de Privacidade</SelfCheckoutLegalDocumentDialog>{" "}
      e a{" "}
      <SelfCheckoutLegalDocumentDialog documentKey="cookies">Política de Cookies</SelfCheckoutLegalDocumentDialog>.
    </p>
  )
}
