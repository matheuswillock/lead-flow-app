import { connection, type NextRequest } from "next/server"
import { paymentProviderConfigUseCase } from "@/app/api/useCases/paymentProviderConfig/paymentProviderConfigComposition"
import type { UpdateProviderConfigInput } from "@/app/api/useCases/paymentProviderConfig/IPaymentProviderConfigUseCase"
import type { CreateProviderInstanceBody } from "@/lib/payment-provider/admin-contract"
import type { ProviderRolloutState } from "@/lib/payment-provider/routing"
import {
  authorizeRead,
  authorizeWrite,
  invalidRequest,
  isRecord,
  isUuid,
  parseEnvironment,
  parseProvider,
  respond,
  toActor,
} from "./providerConfigRoute"

const ROLLOUT_STATES = ["DISABLED", "SANDBOX_VALIDATED", "APPROVED", "ACTIVE"]

export async function GET(request: NextRequest) {
  await connection()
  const guard = await authorizeRead(request)
  if (guard.response) return guard.response

  const environment = parseEnvironment(request.nextUrl.searchParams.get("environment"))
  if (!environment) return invalidRequest("Ambiente inválido")
  return respond(await paymentProviderConfigUseCase.list({ environment }))
}

export async function POST(request: NextRequest) {
  const guard = await authorizeWrite(request)
  if (guard.response) return guard.response

  const body = await readBody(request)
  const input = parseCreateBody(body)
  if (!input) return invalidRequest("Payload de instância inválido")
  return respond(await paymentProviderConfigUseCase.create(input, toActor(guard.access)), 201)
}

export async function PUT(request: NextRequest) {
  const guard = await authorizeWrite(request)
  if (guard.response) return guard.response

  const body = await readBody(request)
  const input = parseUpdateBody(body)
  if (!input) return invalidRequest("Payload de configuração inválido")
  return respond(await paymentProviderConfigUseCase.update(input, toActor(guard.access)))
}

async function readBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function optionalText(value: unknown): string | null | undefined | false {
  if (value === undefined || value === null) return value
  return typeof value === "string" ? value : false
}

function parseCreateBody(body: unknown): CreateProviderInstanceBody | null {
  if (!isRecord(body)) return null
  const providerKey = parseProvider(body.providerKey)
  const environment = parseEnvironment(body.environment)
  const logoUrl = optionalText(body.logoUrl)
  const logoAltText = optionalText(body.logoAltText)
  if (
    !providerKey ||
    !environment ||
    typeof body.externalAccountContext !== "string" ||
    typeof body.displayName !== "string" ||
    logoUrl === false ||
    logoAltText === false
  ) {
    return null
  }
  return {
    providerKey,
    environment,
    externalAccountContext: body.externalAccountContext,
    displayName: body.displayName,
    logoUrl,
    logoAltText,
  }
}

/** Aceita o corpo novo (`id` + campos) e o antigo (`providerKey|provider`, `environment`, `patch`). */
function parseUpdateBody(body: unknown): UpdateProviderConfigInput | null {
  if (!isRecord(body)) return null
  const source = isRecord(body.patch) ? body.patch : body
  if (typeof source.expectedRevision !== "number" || !Number.isInteger(source.expectedRevision)) return null

  let id: string | undefined
  let provider: ReturnType<typeof parseProvider> = null
  let environment: ReturnType<typeof parseEnvironment> = null
  if (body.id !== undefined) {
    if (!isUuid(body.id)) return null
    id = body.id
  } else {
    provider = parseProvider(body.providerKey ?? body.provider)
    environment = parseEnvironment(body.environment)
    if (!provider || !environment) return null
  }

  const input: {
    -readonly [K in keyof UpdateProviderConfigInput]: UpdateProviderConfigInput[K]
  } = { expectedRevision: source.expectedRevision, ...(id ? { id } : {}), ...(provider ? { provider } : {}), ...(environment ? { environment } : {}) }

  for (const key of ["enabled", "isDefault", "killSwitch"] as const) {
    if (source[key] === undefined) continue
    if (typeof source[key] !== "boolean") return null
    input[key] = source[key]
  }
  if (source.externalAccountContext !== undefined) {
    if (typeof source.externalAccountContext !== "string") return null
    input.externalAccountContext = source.externalAccountContext
  }
  if (source.rolloutState !== undefined) {
    if (typeof source.rolloutState !== "string" || !ROLLOUT_STATES.includes(source.rolloutState)) return null
    input.rolloutState = source.rolloutState as ProviderRolloutState
  }
  if (source.displayName !== undefined) {
    if (typeof source.displayName !== "string") return null
    input.displayName = source.displayName
  }
  for (const key of ["logoUrl", "logoAltText"] as const) {
    if (source[key] === undefined) continue
    const value = optionalText(source[key])
    if (value === false) return null
    input[key] = value
  }
  if (source.settings !== undefined) {
    if (!isRecord(source.settings)) return null
    input.settings = source.settings
  }
  return input as UpdateProviderConfigInput
}
