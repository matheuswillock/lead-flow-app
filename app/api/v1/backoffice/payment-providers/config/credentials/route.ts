import type { NextRequest } from "next/server"
import { paymentProviderConfigUseCase } from "@/app/api/useCases/paymentProviderConfig/paymentProviderConfigComposition"
import {
  authorizeWrite,
  invalidRequest,
  isRecord,
  isUuid,
  respond,
  toActor,
} from "../providerConfigRoute"

const CREDENTIAL_RATE_LIMIT = { scope: "credentials", limit: 20 } as const

/** Define ou rotaciona uma credencial. O valor é write-only: nunca aparece na resposta. */
export async function PUT(request: NextRequest) {
  const guard = await authorizeWrite(request, { rateLimit: CREDENTIAL_RATE_LIMIT })
  if (guard.response) return guard.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidRequest("Payload de credencial inválido")
  }
  if (
    !isRecord(body) ||
    !isUuid(body.configId) ||
    typeof body.key !== "string" ||
    typeof body.value !== "string"
  ) {
    return invalidRequest("Payload de credencial inválido")
  }
  return respond(
    await paymentProviderConfigUseCase.setCredential(
      { configId: body.configId, key: body.key, value: body.value },
      toActor(guard.access),
    ),
  )
}

export async function DELETE(request: NextRequest) {
  const guard = await authorizeWrite(request, { rateLimit: CREDENTIAL_RATE_LIMIT })
  if (guard.response) return guard.response

  const configId = request.nextUrl.searchParams.get("configId")
  const key = request.nextUrl.searchParams.get("key")
  if (!isUuid(configId) || !key) return invalidRequest("Payload de credencial inválido")
  return respond(
    await paymentProviderConfigUseCase.deleteCredential({ configId, key }, toActor(guard.access)),
  )
}
