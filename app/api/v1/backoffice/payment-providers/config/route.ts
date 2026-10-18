import { connection, NextResponse, type NextRequest } from "next/server"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { paymentProviderConfigUseCase } from "@/app/api/useCases/paymentProviderConfig/paymentProviderConfigComposition"
import { Output } from "@/lib/output"
import type { ProviderRolloutState } from "@/lib/payment-provider/routing"
import type { ProviderRoutingConfigPatch } from "@/lib/payment-provider/routing-config"
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
    const patch = parsePatch(body?.patch)
    if (!environment || !provider || !patch)
      return invalidRequest("Payload de configuração inválido")

    const output = await paymentProviderConfigUseCase.update({ environment, provider, patch })
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

function parsePatch(value: unknown): ProviderRoutingConfigPatch | null {
  if (
    !isRecord(value) ||
    typeof value.expectedRevision !== "number" ||
    !Number.isInteger(value.expectedRevision)
  ) {
    return null
  }
  const patch: {
    enabled?: boolean
    isDefault?: boolean
    externalAccountContext?: string
    rolloutState?: ProviderRolloutState
    killSwitch?: boolean
    expectedRevision: number
  } = { expectedRevision: value.expectedRevision }
  if (value.enabled !== undefined) {
    if (typeof value.enabled !== "boolean") return null
    patch.enabled = value.enabled
  }
  if (value.isDefault !== undefined) {
    if (typeof value.isDefault !== "boolean") return null
    patch.isDefault = value.isDefault
  }
  if (value.externalAccountContext !== undefined) {
    if (typeof value.externalAccountContext !== "string") return null
    patch.externalAccountContext = value.externalAccountContext
  }
  if (value.rolloutState !== undefined) {
    if (
      typeof value.rolloutState !== "string" ||
      !["DISABLED", "SANDBOX_VALIDATED", "APPROVED", "ACTIVE"].includes(value.rolloutState)
    ) {
      return null
    }
    patch.rolloutState = value.rolloutState as ProviderRolloutState
  }
  if (value.killSwitch !== undefined) {
    if (typeof value.killSwitch !== "boolean") return null
    patch.killSwitch = value.killSwitch
  }
  return patch
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function invalidRequest(message: string) {
  return NextResponse.json(new Output(false, [], [message], null), { status: 400 })
}
