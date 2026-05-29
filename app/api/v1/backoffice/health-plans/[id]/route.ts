import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeHealthPlanUseCase } from "@/app/api/useCases/backofficeHealthPlan/BackofficeHealthPlanUseCase"

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  iconUrl: z.string().trim().optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })

    const { id } = await context.params
    const parsed = updateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const output = await backofficeHealthPlanUseCase.update(id, parsed.data)
    const status = output.isValid ? 200 : output.errorMessages.includes("Plano de saúde não encontrado") ? 404 : 400
    return NextResponse.json(output, { status })
  } catch (error) {
    console.error("[BackofficeHealthPlanByIdRoute][PUT]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })

    const { id } = await context.params
    const output = await backofficeHealthPlanUseCase.deactivate(id)
    const status = output.isValid ? 200 : output.errorMessages.includes("Plano de saúde não encontrado") ? 404 : 400
    return NextResponse.json(output, { status })
  } catch (error) {
    console.error("[BackofficeHealthPlanByIdRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
