import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailTemplateUseCase } from "@/app/api/useCases/email/EmailTemplateUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const rejectSchema = z.object({
  reviewNote: z.string().min(1).max(500),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const body = await request.json().catch(() => null)
    const validation = rejectSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 })
    }

    const useCase = new EmailTemplateUseCase()
    const output = await useCase.reject(id, validation.data.reviewNote, teamAccess.access)
    return NextResponse.json(output, { status: output.isValid ? 200 : output.errorMessages.length ? 400 : 403 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailTemplateRejectRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
