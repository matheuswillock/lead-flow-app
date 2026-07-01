import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailTemplateUseCase } from "@/app/api/useCases/email/EmailTemplateUseCase"
import { isManagerLikeRole } from "@/lib/roles"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const functionDefinitionSchema = z.object({
  operator: z.enum([
    "current_year",
    "current_month",
    "current_day",
    "current_date",
    "current_time",
    "current_date_time",
    "sum",
    "subtract",
    "multiply",
    "divide",
    "concat",
  ]),
  arguments: z.array(z.string()).optional(),
  separator: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
})

const variableSchema = z.object({
  key: z.string().min(1),
  kind: z.enum(["variable", "function"]).optional(),
  type: z.enum(["string", "number"]).optional(),
  fallbackValue: z.string().nullable().optional(),
  reviewStatus: z.enum(["pending", "reviewed"]).optional(),
  definition: functionDefinitionSchema.nullable().optional(),
})

const createSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  subject: z.string().min(1, "Assunto é obrigatório"),
  previewText: z.string().optional(),
  mailyJson: z.unknown().optional(),
  html: z.string().optional(),
  editorMode: z.enum(["blocks", "html"]).optional(),
  variables: z.array(variableSchema).optional(),
})

function makeUseCase() {
  return new EmailTemplateUseCase()
}

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const useCase = makeUseCase()
    const scope = request.nextUrl.searchParams.get("scope") === "campaign" ? "campaign" : "workbench"
    const output = await useCase.list(teamAccess.access, "all", scope)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailTemplatesRoute][GET]", error)
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
        new Output(false, [], ["Apenas managers podem criar templates de email"], null),
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
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailTemplatesRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
