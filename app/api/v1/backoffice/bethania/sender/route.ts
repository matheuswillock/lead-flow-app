import { NextResponse, type NextRequest } from "next/server"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeBethaniaUseCase } from "@/app/api/useCases/backofficeBethania/BackofficeBethaniaUseCase"

export async function PATCH(request: NextRequest) {
  const access = await getBackofficeAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }
  if (!body || typeof body !== "object" || typeof (body as { webhookUrl?: unknown }).webhookUrl !== "string") {
    return NextResponse.json({ error: "URL do conector inválida" }, { status: 400 })
  }
  try {
    const output = await backofficeBethaniaUseCase.execute({
      operation: "set-sender-url",
      webhookUrl: (body as { webhookUrl: string }).webhookUrl,
      actorProfileId: access.access.profileId,
    })
    if (!output.isValid) {
      return NextResponse.json(
        { error: output.errorMessages[0] ?? "Erro interno" },
        { status: output.result?.status ?? 500 },
      )
    }
    return NextResponse.json(output.result)
  } catch (error) {
    if (error instanceof Error && (error.message === "URL do conector inválida" || error.message === "URL do conector não permitida")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("[BackofficeBethaniaSenderRoute][PATCH]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
