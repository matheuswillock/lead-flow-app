import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailCampaignUseCase } from "@/app/api/useCases/email/EmailCampaignUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const listStrategySchema = z.enum(["single", "merge", "per_list"])

const previewPlanSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    templateId: z.string().uuid("templateId inválido"),
    contactListId: z.string().uuid("contactListId inválido").optional(),
    contactListIds: z.array(z.string().uuid()).optional(),
    listStrategy: listStrategySchema.optional(),
    radarSegmentSlug: z.string().min(1).optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
    scheduleIntervalDays: z.number().int().min(1).optional().nullable(),
    uniformSchedule: z.boolean().optional(),
    subCampaignSchedules: z
      .array(
        z.object({
          index: z.number().int().min(1),
          scheduledAt: z.string().datetime(),
        })
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    const hasList = Boolean(data.contactListId) || (data.contactListIds?.length ?? 0) > 0
    if (!hasList && !data.radarSegmentSlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe contactListId, contactListIds ou radarSegmentSlug",
        path: ["contactListId"],
      })
    }
    if (hasList && data.radarSegmentSlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use apenas listas de contatos ou segmento Radar",
        path: ["contactListId"],
      })
    }
  })

function makeUseCase() {
  return new EmailCampaignUseCase()
}

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const body = await request.json().catch(() => null)
    const validation = previewPlanSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 })
    }

    const useCase = makeUseCase()
    const output = await useCase.previewPlan(validation.data, teamAccess.access)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailCampaignPreviewPlanRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
