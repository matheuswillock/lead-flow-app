import { NextResponse, type NextRequest, connection } from "next/server";
import { z } from "zod"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeHealthPlanUseCase } from "@/app/api/useCases/backofficeHealthPlan/BackofficeHealthPlanUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const createSchema = z.object({
  name: z.string().trim().min(1),
  iconUrl: z.string().trim().optional().nullable(),
  isDefault: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  await connection();

  try {
    const access = await getBackofficeAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })

    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true"
    const output = await backofficeHealthPlanUseCase.list(includeInactive)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeHealthPlansRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })
    const denied = requireManagerAccess(access.access)
    if (denied) return denied

    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const output = await backofficeHealthPlanUseCase.create({
      ...parsed.data,
      createdBy: access.access.profileId,
    })
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeHealthPlansRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
