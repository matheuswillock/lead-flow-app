import { connection, NextResponse, type NextRequest } from "next/server"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { paymentProviderConfigUseCase } from "@/app/api/useCases/paymentProviderConfig/paymentProviderConfigComposition"
import { Output } from "@/lib/output"
import { parseProviderConfigPatch } from "./parseProviderConfigPatch"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export async function GET(request: NextRequest) {
  await connection()
  const access = await getBackofficeAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })

  const environment = parseEnvironment(request.nextUrl.searchParams.get("environment"))
  if (!environment) return invalidRequest("Ambiente inválido")
  const output = await paymentProviderConfigUseCase.list({ environment })
  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}

export async function PUT(request: NextRequest) {
  const access = await getBackofficeAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const denied = requireManagerAccess(access.access)
  if (denied) return denied

  try {
    const body = await request.json()
    const environment = parseEnvironment(body?.environment)
    const provider = parseProvider(body?.provider)
    const patch = parseProviderConfigPatch(body?.patch)
    if (!environment || !provider || !patch)
      return invalidRequest("Payload de configuração inválido")

    const output = await paymentProviderConfigUseCase.update({
      environment,
      provider,
      patch,
      actor: {
        profileId: access.access.profileId,
        backofficeUserId: access.access.backofficeUserId,
      },
    })
    return NextResponse.json(output, { status: output.isValid ? 200 : 409 })
  } catch (error) {
    console.error("[BackofficePaymentProviderConfigRoute][PUT]", error)
    return invalidRequest("Payload de configuração inválido")
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
