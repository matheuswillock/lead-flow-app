import { connection, NextResponse, type NextRequest } from "next/server"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { paymentProviderInstancesUseCase } from "@/app/api/useCases/paymentProviderInstances/paymentProviderInstancesComposition"
import { Output } from "@/lib/output"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"
import { protectPaymentProviderWrite } from "../protectWrite"

export async function GET(request: NextRequest) {
  await connection()
  const access = await getBackofficeAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const environment = parseEnvironment(request.nextUrl.searchParams.get("environment"))
  if (request.nextUrl.searchParams.has("environment") && !environment) {
    return invalidRequest("Ambiente inválido")
  }
  const output = await paymentProviderInstancesUseCase.list(environment ?? undefined)
  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}

export async function POST(request: NextRequest) {
  const access = await getBackofficeAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const denied = requireManagerAccess(access.access)
  if (denied) return denied
  const protection = await protectPaymentProviderWrite(request, access.access.profileId)
  if (protection) return protection

  try {
    const body = await request.json()
    const provider = parseProvider(body?.provider)
    const environment = parseEnvironment(body?.environment)
    if (!provider || !environment || !isStringRecord(body?.credentials)) {
      return invalidRequest("Payload de instância inválido")
    }
    const output = await paymentProviderInstancesUseCase.create({
      provider,
      environment,
      displayName: typeof body.displayName === "string" ? body.displayName : "",
      externalAccountContext: typeof body.externalAccountContext === "string" ? body.externalAccountContext : "",
      isDefault: body.isDefault === true,
      logoUrl: typeof body.logoUrl === "string" ? body.logoUrl : null,
      logoAltText: typeof body.logoAltText === "string" ? body.logoAltText : null,
      credentials: body.credentials,
      actorProfileId: access.access.profileId,
    })
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    console.error("[BackofficePaymentProviderInstancesRoute][POST]", error)
    return invalidRequest("Payload de instância inválido")
  }
}

export async function PUT(request: NextRequest) {
  const access = await getBackofficeAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const denied = requireManagerAccess(access.access)
  if (denied) return denied
  const protection = await protectPaymentProviderWrite(request, access.access.profileId)
  if (protection) return protection

  try {
    const body = await request.json()
    if (typeof body?.id !== "string" || !isStringRecord(body?.credentials ?? {})) {
      return invalidRequest("Payload de atualização inválido")
    }
    const output = await paymentProviderInstancesUseCase.update({
      id: body.id,
      ...(typeof body.displayName === "string" ? { displayName: body.displayName } : {}),
      ...(typeof body.logoUrl === "string" || body.logoUrl === null ? { logoUrl: body.logoUrl } : {}),
      ...(typeof body.logoAltText === "string" || body.logoAltText === null ? { logoAltText: body.logoAltText } : {}),
      ...(typeof body.isDefault === "boolean" ? { isDefault: body.isDefault } : {}),
      credentials: body.credentials ?? {},
      actorProfileId: access.access.profileId,
    })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficePaymentProviderInstancesRoute][PUT]", error)
    return invalidRequest("Payload de atualização inválido")
  }
}

function parseEnvironment(value: unknown): PaymentProviderEnvironment | null {
  return value === "DEV" || value === "PRODUCTION" ? value : null
}

function parseProvider(value: unknown): PaymentProviderKey | null {
  return value === "ASAAS" || value === "ABACATE_PAY" ? value : null
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
}

function invalidRequest(message: string) {
  return NextResponse.json(new Output(false, [], [message], null), { status: 400 })
}
