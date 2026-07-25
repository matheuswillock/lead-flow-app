import { type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { publicFormDraftSchema } from "@/lib/public-forms/validation"
import { backofficeStudioPublicFormsUseCase } from "@/app/api/useCases/backofficeStudioPublicForms/BackofficeStudioPublicFormsUseCase"
import {
  parsePositiveInt,
  resolveStudioPublicFormsActor,
  studioPublicFormsJson,
  type StudioPublicFormsRouteParams,
} from "@/app/api/v1/backoffice/utils/studioPublicFormsRoute"

type RouteContext = { params: Promise<StudioPublicFormsRouteParams> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioPublicFormsActor(request, params, {
      requireManager: false,
    })
    if (resolved.error) return resolved.error

    const query = request.nextUrl.searchParams
    const page = parsePositiveInt(query.get("page"), 1)
    const pageSize = Math.min(parsePositiveInt(query.get("pageSize"), 20), 100)
    const status = query
      .get("status")
      ?.split(",")
      .filter((value) => ["draft", "published", "archived"].includes(value)) as
      | Array<"draft" | "published" | "archived">
      | undefined
    const approvalStatus = query
      .get("approvalStatus")
      ?.split(",")
      .filter((value) =>
        ["draft", "pending_approval", "approved", "rejected"].includes(value)
      ) as
      | Array<"draft" | "pending_approval" | "approved" | "rejected">
      | undefined

    const output = await backofficeStudioPublicFormsUseCase.list(resolved.actor, {
      search: query.get("search") || undefined,
      status: status?.length ? status : undefined,
      approvalStatus: approvalStatus?.length ? approvalStatus : undefined,
      assignedSdrId: query.get("assignedSdrId") || undefined,
      updatedFrom: query.get("updatedFrom") ? new Date(query.get("updatedFrom")!) : undefined,
      updatedTo: query.get("updatedTo") ? new Date(query.get("updatedTo")!) : undefined,
      page,
      pageSize,
    })
    return studioPublicFormsJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioPublicFormsRoute][GET]", error)
    return studioPublicFormsJson(new Output(false, [], ["Erro interno"], null), 500)
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioPublicFormsActor(request, params)
    if (resolved.error) return resolved.error

    const parsed = publicFormDraftSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return studioPublicFormsJson(
        new Output(
          false,
          [],
          parsed.error.issues.map((issue) => issue.message),
          null
        )
      )
    }

    const output = await backofficeStudioPublicFormsUseCase.create(resolved.actor, parsed.data)
    return studioPublicFormsJson(output, 201)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioPublicFormsRoute][POST]", error)
    return studioPublicFormsJson(new Output(false, [], ["Erro interno"], null), 500)
  }
}
