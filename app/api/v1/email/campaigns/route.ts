import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailCampaignUseCase } from "@/app/api/useCases/email/EmailCampaignUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const listStrategySchema = z.enum(["single", "merge", "per_list"])

const createSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    description: z.string().max(500).nullable().optional(),
    templateId: z.string().uuid("templateId inválido"),
    contactListId: z.string().uuid("contactListId inválido").optional(),
    contactListIds: z.array(z.string().uuid()).optional(),
    listStrategy: listStrategySchema.optional(),
    radarSegmentSlug: z.string().min(1).optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
    scheduleIntervalDays: z.number().int().min(1).optional().nullable(),
    uniformSchedule: z.boolean().optional(),
    saveAsRadarSegment: z.boolean().optional(),
    saveAsRadarSegmentName: z.string().max(120).nullable().optional(),
    subCampaignSchedules: z
      .array(
        z.object({
          index: z.number().int().min(1),
          scheduledAt: z.string().datetime(),
        })
      )
      .optional(),
    subCampaignTemplates: z
      .array(
        z.object({
          index: z.number().int().min(1),
          templateId: z.string().uuid(),
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
  })

const campaignStatusSchema = z.enum(["draft", "scheduled", "sending", "sent", "canceled", "failed", "archived"])

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
    const statusParams = searchParams
      .getAll("status")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean)
    const uniqueStatusParams = Array.from(new Set(statusParams))
    const parsedStatuses: z.infer<typeof campaignStatusSchema>[] = []
    for (const statusParam of uniqueStatusParams) {
      const parsed = campaignStatusSchema.safeParse(statusParam)
      if (!parsed.success) {
        return NextResponse.json(new Output(false, [], ["Status de campanha inválido"], null), { status: 400 })
      }
      parsedStatuses.push(parsed.data)
    }
    const name = searchParams.get("name") ?? undefined
    const createdAtFrom = searchParams.get("createdAtFrom") ?? undefined
    const createdAtTo = searchParams.get("createdAtTo") ?? undefined

    const useCase = makeUseCase()
    const output = await useCase.list(teamAccess.access, {
      status: parsedStatuses.length > 0 ? parsedStatuses : undefined,
      page,
      pageSize,
      name,
      createdAtFrom,
      createdAtTo,
    })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
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

    const body = await request.json().catch(() => null)
    const validation = createSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 })
    }

    const useCase = makeUseCase()
    const output = await useCase.create(validation.data, teamAccess.access)
    const status = !output.isValid
      ? output.errorMessages.some((message) => message.includes("permissão"))
        ? 403
        : 400
      : 201
    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailCampaignsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
