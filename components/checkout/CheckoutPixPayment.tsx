"use client"

import type { ComponentProps } from "react"

import { AdhesionPixPanel } from "@/app/adesao/[token]/features/components/AdhesionPixPanel"

/**
 * Ponto de entrada do kit para o pagamento por PIX. Por enquanto repassa tudo para
 * AdhesionPixPanel; a implementação pode mudar sem alterar as jornadas que importam daqui.
 */
export type CheckoutPixPaymentProps = ComponentProps<typeof AdhesionPixPanel>

export function CheckoutPixPayment(props: CheckoutPixPaymentProps) {
  return <AdhesionPixPanel {...props} />
}
