import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailTemplateUseCase } from "@/app/api/useCases/email/EmailTemplateUseCase"
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

const bodySchema = z.object({
  to: z.string().email("Endereço de email inválido"),
  subject: z.string().min(1, "Assunto é obrigatório"),
  html: z.string().min(1, "HTML é obrigatório"),
  variables: z.array(z.object({
    key: z.string().min(1),
    kind: z.enum(["variable", "function"]).optional(),
    type: z.enum(["string", "number"]).optional(),
    fallbackValue: z.string().nullable().optional(),
    reviewStatus: z.enum(["pending", "reviewed"]).optional(),
    definition: functionDefinitionSchema.nullable().optional(),
    value: z.string().optional().default(""),
  })).optional().default([]),
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
    const validation = bodySchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 })
    }

    const useCase = new EmailTemplateUseCase()
    const output = await useCase.sendTest(
      id,
      {
        to: validation.data.to,
        subject: validation.data.subject,
        html: validation.data.html,
        variables: validation.data.variables,
      },
      teamAccess.access
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailTemplateTestRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
