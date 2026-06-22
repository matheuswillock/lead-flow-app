import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailCampaignUseCase } from "@/app/api/useCases/email/EmailCampaignUseCase"
import { isManagerLikeRole } from "@/lib/roles"

const createSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  templateId: z.string().uuid("templateId inválido"),
  contactListId: z.string().uuid("contactListId inválido"),
  scheduledAt: z.string().datetime().nullable().optional(),
})

const campaignStatusSchema = z.enum(["draft", "scheduled", "sending", "sent", "canceled", "failed"])

function makeUseCase() {
  return new EmailCampaignUseCase()
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const { searchParams } = new URL(request.url)
    const page = parsePositiveInt(searchParams.get("page"), 1)
    const pageSize = Math.min(parsePositiveInt(searchParams.get("pageSize"), 20), 100)
    const statusParam = searchParams.get("status")
    const status = statusParam ? campaignStatusSchema.safeParse(statusParam) : null

    if (statusParam && !status?.success) {
      return NextResponse.json(new Output(false, [], ["Status de campanha inválido"], null), { status: 400 })
    }

    const useCase = makeUseCase()
    const output = await useCase.list(teamAccess.access, { status: status?.data, page, pageSize })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[EmailCampaignsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem criar campanhas"], null),
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const validation = createSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 })
    }

    const useCase = makeUseCase()
    const output = await useCase.create(validation.data, teamAccess.access)
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    console.error("[EmailCampaignsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
