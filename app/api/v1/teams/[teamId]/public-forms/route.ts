import { NextRequest } from "next/server"
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import { publicFormDraftSchema } from "@/lib/public-forms/validation"
import { Output } from "@/lib/output"
import { outputResponse, resolvePublicFormsAccess } from "./_utils"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const resolved = await resolvePublicFormsAccess(request, params)
  if ("response" in resolved) return resolved.response
  const query = request.nextUrl.searchParams
  const page = Math.max(1, Number(query.get("page") || 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.get("pageSize") || 20)))
  const status = query
    .get("status")
    ?.split(",")
    .filter((value) => ["draft", "published", "archived"].includes(value)) as
    | Array<"draft" | "published" | "archived">
    | undefined
  const approvalStatus = query
    .get("approvalStatus")
    ?.split(",")
    .filter((value) => ["draft", "pending_approval", "approved", "rejected"].includes(value)) as
    | Array<"draft" | "pending_approval" | "approved" | "rejected">
    | undefined
  const output = await publicFormsUseCase.list(resolved.access, {
    search: query.get("search") || undefined,
    status: status?.length ? status : undefined,
    approvalStatus: approvalStatus?.length ? approvalStatus : undefined,
    assignedSdrId: query.get("assignedSdrId") || undefined,
    updatedFrom: query.get("updatedFrom") ? new Date(query.get("updatedFrom")!) : undefined,
    updatedTo: query.get("updatedTo") ? new Date(query.get("updatedTo")!) : undefined,
    page,
    pageSize,
  })
  return outputResponse(output)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const resolved = await resolvePublicFormsAccess(request, params)
  if ("response" in resolved) return resolved.response
  const parsed = publicFormDraftSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return outputResponse(
      new Output(
        false,
        [],
        parsed.error.issues.map((issue) => issue.message),
        null,
      ),
    )
  }
  return outputResponse(await publicFormsUseCase.create(resolved.access, parsed.data), 201)
}
