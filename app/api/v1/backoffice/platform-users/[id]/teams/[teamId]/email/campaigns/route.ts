import { type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioEmailUseCase } from "@/app/api/useCases/backofficeStudioEmail/BackofficeStudioEmailUseCase"
import {
  parsePositiveInt,
  resolveStudioEmailActor,
  studioEmailJson,
  type StudioEmailRouteParams,
} from "@/app/api/v1/backoffice/utils/studioEmailRoute"

const createSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    templateId: z.string().uuid("templateId inválido"),
    contactListId: z.string().uuid("contactListId inválido").optional(),
    radarSegmentSlug: z.string().min(1).optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
    scheduleIntervalDays: z.number().int().min(1).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.contactListId && !data.radarSegmentSlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe contactListId ou radarSegmentSlug",
        path: ["contactListId"],
      })
    }
  })

const campaignStatusSchema = z.enum([
  "draft",
  "scheduled",
  "sending",
  "sent",
  "canceled",
  "failed",
  "archived",
])

type RouteContext = { params: Promise<StudioEmailRouteParams> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioEmailActor(request, params, { requireManager: false })
    if (resolved.error) return resolved.error

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
        return studioEmailJson(new Output(false, [], ["Status de campanha inválido"], null))
      }
      parsedStatuses.push(parsed.data)
    }

    const output = await backofficeStudioEmailUseCase.listCampaigns(resolved.actor, {
      status: parsedStatuses.length > 0 ? parsedStatuses : undefined,
      page,
      pageSize,
      name: searchParams.get("name") ?? undefined,
      createdAtFrom: searchParams.get("createdAtFrom") ?? undefined,
      createdAtTo: searchParams.get("createdAtTo") ?? undefined,
    })
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailCampaignsRoute][GET]", error)
    return studioEmailJson(new Output(false, [], ["Erro interno"], null), 500)
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioEmailActor(request, params)
    if (resolved.error) return resolved.error

    const body = await request.json().catch(() => null)
    const validation = createSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return studioEmailJson(new Output(false, [], errors, null))
    }

    const output = await backofficeStudioEmailUseCase.createCampaign(resolved.actor, validation.data)
    return studioEmailJson(output, 201)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailCampaignsRoute][POST]", error)
    return studioEmailJson(new Output(false, [], ["Erro interno"], null), 500)
  }
}
