import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { updateWhatsAppContactUseCase } from "@/app/api/useCases/whatsapp/UpdateWhatsAppContactUseCase"

const updateSchema = z.object({
  phone: z.string().min(8).optional(),
  name: z.string().trim().min(1).max(120).nullable().optional(),
}).refine((value) => value.phone !== undefined || value.name !== undefined, { message: "Informe nome ou telefone" })

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ teamId: string; contactId: string }> }) {
  const { teamId, contactId } = await params
  const teamAccess = await getTeamAccess(request)
  if ("error" in teamAccess) return NextResponse.json(teamAccess.error, { status: teamAccess.status })
  if (teamAccess.access.teamId !== teamId) {
    return NextResponse.json(new Output(false, [], ["Acesso negado a este time"], null), { status: 403 })
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
  const output = await updateWhatsAppContactUseCase.execute({ teamId, contactId, access: teamAccess.access, ...parsed.data })
  const message = output.errorMessages.join(" ")
  const status = output.isValid ? 200 : message.includes("não encontrado") ? 404 : message.includes("Já existe") ? 409 : 400
  return NextResponse.json(output, { status })
}
