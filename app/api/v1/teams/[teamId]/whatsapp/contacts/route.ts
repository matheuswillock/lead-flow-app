import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { listWhatsAppContactsUseCase } from "@/app/api/useCases/whatsapp/ListWhatsAppContactsUseCase"
import { createOrGetWhatsAppContactUseCase } from "@/app/api/useCases/whatsapp/CreateOrGetWhatsAppContactUseCase"
import { z } from "zod"

const createContactSchema = z.object({ phone: z.string().min(8), name: z.string().trim().min(1).max(120).optional() })

function resolveStatus(output: Output): number {
  const msg = output.errorMessages.join(" ")
  if (msg.includes("não encontrad")) return 404
  if (msg.includes("não está conectado")) return 409
  if (msg.includes("Erro interno") || msg.includes("inesperado")) return 500
  return 400
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const teamAccess = await getTeamAccess(request)
  if ("error" in teamAccess) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status })
  }

  if (teamAccess.access.teamId !== teamId) {
    return NextResponse.json(
      new Output(false, [], ["Acesso negado a este time"], null),
      { status: 403 }
    )
  }

  const url = new URL(request.url)
  const q = url.searchParams.get("q") ?? undefined
  const groupJid = url.searchParams.get("groupJid") ?? undefined

  const output = await listWhatsAppContactsUseCase.execute({
    teamId,
    access: teamAccess.access,
    q,
    groupJid,
  })
  if (!output.isValid) {
    return NextResponse.json(output, { status: resolveStatus(output) })
  }

  return NextResponse.json(output)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const teamAccess = await getTeamAccess(request)
  if ("error" in teamAccess) return NextResponse.json(teamAccess.error, { status: teamAccess.status })
  if (teamAccess.access.teamId !== teamId) {
    return NextResponse.json(new Output(false, [], ["Acesso negado a este time"], null), { status: 403 })
  }
  const parsed = createContactSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
  const output = await createOrGetWhatsAppContactUseCase.execute({
    teamId,
    access: teamAccess.access,
    phone: parsed.data.phone,
    name: parsed.data.name,
  })
  return NextResponse.json(output, { status: output.isValid ? 200 : resolveStatus(output) })
}
