import { connection, type NextRequest } from "next/server"
import { paymentProviderConfigUseCase } from "@/app/api/useCases/paymentProviderConfig/paymentProviderConfigComposition"
import { authorizeRead, invalidRequest, isUuid, respond } from "../providerConfigRoute"

export async function GET(request: NextRequest) {
  await connection()
  const guard = await authorizeRead(request)
  if (guard.response) return guard.response

  const configId = request.nextUrl.searchParams.get("configId")
  if (!isUuid(configId)) return invalidRequest("configId inválido")
  return respond(await paymentProviderConfigUseCase.history({ configId }))
}
