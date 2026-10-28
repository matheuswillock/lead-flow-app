import { NextResponse } from "next/server"
import { Output } from "@/lib/output"
import {
  PaymentMethodUnavailableError,
  assertBillingTypeAllowed,
  type CardEnabledReader,
} from "./availability"

export const PAYMENT_METHOD_UNAVAILABLE_CODE = "PAYMENT_METHOD_UNAVAILABLE"

export function paymentMethodUnavailableOutput(error: PaymentMethodUnavailableError): Output {
  return new Output(false, [], [error.message], null)
}

/** Output de erro marcado com o código, para a rota responder 422 em vez do 400 genérico. */
export function markedUnavailableOutput(error: PaymentMethodUnavailableError): Output {
  const output = paymentMethodUnavailableOutput(error)
  output.result = { code: PAYMENT_METHOD_UNAVAILABLE_CODE }
  return output
}

export function isMethodUnavailableOutput(output: Output): boolean {
  return (output.result as { code?: string } | null)?.code === PAYMENT_METHOD_UNAVAILABLE_CODE
}

/** Status HTTP de um Output inválido: 422 quando o método está indisponível, senão o padrão da rota. */
export function failedOutputStatus(output: Output, fallbackStatus = 400): number {
  return isMethodUnavailableOutput(output) ? 422 : fallbackStatus
}

/** Mapeia o erro de método indisponível para HTTP 422; qualquer outro erro devolve null. */
export function toPaymentMethodUnavailableResponse(error: unknown): NextResponse | null {
  if (!(error instanceof PaymentMethodUnavailableError)) return null
  return NextResponse.json(paymentMethodUnavailableOutput(error), { status: error.status })
}

/** Guard para rotas sem isenção: resposta 422 quando o cartão não pode ser escolhido. */
export async function rejectUnavailableBillingType(
  billingType: unknown,
  env: Record<string, string | undefined> = process.env,
  readCardEnabled?: CardEnabledReader,
): Promise<NextResponse | null> {
  try {
    await assertBillingTypeAllowed(
      typeof billingType === "string" ? billingType : null,
      {},
      env,
      readCardEnabled,
    )
    return null
  } catch (error) {
    const response = toPaymentMethodUnavailableResponse(error)
    if (response) return response
    throw error
  }
}
