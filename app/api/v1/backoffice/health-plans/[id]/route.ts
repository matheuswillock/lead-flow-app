import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { backofficeHealthPlanUseCase } from "@/app/api/useCases/backofficeHealthPlan/BackofficeHealthPlanUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  iconUrl: z.string().trim().optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  password: z.string().optional(),
})

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })
    const denied = requireMasterAccess(access.access)
    if (denied) return denied

    const { id } = await context.params
    const parsed = updateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const output = await backofficeHealthPlanUseCase.update(
      id,
      parsed.data,
      parsed.data.isActive !== undefined
        ? { email: access.access.backofficeEmail, password: parsed.data.password }
        : undefined
    )
    const firstError = output.errorMessages[0] ?? ""
    const status = output.isValid ? 200 : firstError === "Plano de saúde não encontrado" ? 404 : firstError === "Senha incorreta" ? 401 : 400
    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
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
    const denied = requireMasterAccess(access.access)
    if (denied) return denied

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const password = typeof body.password === "string" ? body.password : ""
    const output = await backofficeHealthPlanUseCase.deactivate(id, {
      email: access.access.backofficeEmail,
      password,
    })
    const firstError = output.errorMessages[0] ?? ""
    const status = output.isValid ? 200 : firstError === "Plano de saúde não encontrado" ? 404 : firstError === "Senha incorreta" ? 401 : 400
    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeHealthPlanByIdRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
