import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { leadAdministratorInterviewUseCase } from "@/app/api/useCases/leadAdministratorInterview/leadAdministratorInterviewComposition"
import { interviewServerError, interviewStatusOf, resolveInterviewWriteAccess } from "../interviewAccess"

type Params = { params: Promise<{ id: string }> }

/** "sent": o usuário abriu o WhatsApp com a mensagem; "postpone": vira tarefa pendente para ele. */
const noticeSchema = z.object({ action: z.enum(["sent", "postpone"]) })

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const resolved = await resolveInterviewWriteAccess(request)
    if (resolved.response) return resolved.response
    const parsed = noticeSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json(new Output(false, [], ["Ação inválida"], null), { status: 400 })

    const { id } = await params
    const scope = { leadId: id, ...resolved.access }
    const output =
      parsed.data.action === "sent"
        ? await leadAdministratorInterviewUseCase.markClientNotified(scope)
        : await leadAdministratorInterviewUseCase.postponeClientNotice(scope)
    return NextResponse.json(output, { status: interviewStatusOf(output) })
  } catch (error) {
    return interviewServerError(error, "client-notice")
  }
}
