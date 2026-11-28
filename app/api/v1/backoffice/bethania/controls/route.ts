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
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  const input = body as { scope?: unknown; eventType?: unknown; paused?: unknown }
  if ((input.scope !== "global" && input.scope !== "event") || typeof input.paused !== "boolean") {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }
  if (input.scope === "event" && typeof input.eventType !== "string") {
    return NextResponse.json({ error: "Evento inválido" }, { status: 400 })
  }
  try {
    const output = await backofficeBethaniaUseCase.execute({
      operation: "set-pause",
      scope: input.scope,
      ...(typeof input.eventType === "string" ? { eventType: input.eventType } : {}),
      paused: input.paused,
      actorProfileId: access.access.profileId,
    })
    if (!output.isValid) {
      return NextResponse.json(
        { error: output.errorMessages[0] ?? "Erro interno" },
        { status: output.result?.status ?? 500 },
      )
    }
    return NextResponse.json({ updated: true })
  } catch (error) {
    console.error("[BackofficeBethaniaControlsRoute][PATCH]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
