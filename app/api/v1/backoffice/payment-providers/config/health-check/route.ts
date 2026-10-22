import type { NextRequest } from "next/server"
import { paymentProviderHealthCheckUseCase } from "@/app/api/useCases/paymentProviderConfig/paymentProviderConfigComposition"
import {
  authorizeWrite,
  invalidRequest,
  isRecord,
  isUuid,
  parseEnvironment,
  parseProvider,
  respond,
} from "../providerConfigRoute"

export async function POST(request: NextRequest) {
  const guard = await authorizeWrite(request)
  if (guard.response) return guard.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidRequest("Payload de health-check inválido")
  }
  if (!isRecord(body)) return invalidRequest("Payload de health-check inválido")

  const actor = { profileId: guard.access.profileId, backofficeUserId: guard.access.backofficeUserId }
  if (body.id !== undefined) {
    if (!isUuid(body.id)) return invalidRequest("Payload de health-check inválido")
    return respond(await paymentProviderHealthCheckUseCase.check({ id: body.id, actor }))
  }
  const provider = parseProvider(body.providerKey ?? body.provider)
  const environment = parseEnvironment(body.environment)
  if (!provider || !environment) return invalidRequest("Payload de health-check inválido")
  return respond(await paymentProviderHealthCheckUseCase.check({ provider, environment, actor }))
}
