import { NextResponse, type NextRequest } from "next/server"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { paymentProviderHealthCheckUseCase } from "@/app/api/useCases/paymentProviderConfig/paymentProviderConfigComposition"
import { Output } from "@/lib/output"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export async function POST(request: NextRequest) {
  const access = await getBackofficeAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const denied = requireManagerAccess(access.access)
  if (denied) return denied

  try {
    const body = await request.json()
    const environment = parseEnvironment(body?.environment)
    const provider = parseProvider(body?.provider)
    if (!environment || !provider) return invalidRequest("Payload de health-check inválido")

    const output = await paymentProviderHealthCheckUseCase.check({
      environment,
      provider,
      actor: {
        profileId: access.access.profileId,
        backofficeUserId: access.access.backofficeUserId,
      },
    })
    return NextResponse.json(output, { status: output.isValid ? 200 : 409 })
  } catch (error) {
    console.error("[BackofficePaymentProviderHealthCheckRoute][POST]", error)
    return invalidRequest("Payload de health-check inválido")
  }
}

function parseEnvironment(value: unknown): PaymentProviderEnvironment | null {
  return value === "DEV" || value === "PRODUCTION" ? value : null
}

function parseProvider(value: unknown): PaymentProviderKey | null {
  return value === "ASAAS" || value === "ABACATE_PAY" ? value : null
}

function invalidRequest(message: string) {
  return NextResponse.json(new Output(false, [], [message], null), { status: 400 })
}
