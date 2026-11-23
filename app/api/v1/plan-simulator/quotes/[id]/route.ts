import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { PlanQuoteUseCase, PLAN_QUOTE_MESSAGES } from "@/app/api/useCases/planSimulator/PlanQuoteUseCase"
import { requirePlanSimulatorScope } from "../../guard"

const patchSchema = z.object({ nome: z.string().min(1).max(200).optional(), state: z.unknown().optional() })

function statusFor(output: Output): number {
  if (output.isValid) return 200
  return output.errorMessages.includes(PLAN_QUOTE_MESSAGES.NOT_FOUND) ? 404 : 400
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requirePlanSimulatorScope(request)
  if (guard.error) return guard.error
  const { id } = await context.params
  const output = await new PlanQuoteUseCase().get(id, guard.scope)
  return NextResponse.json(output, { status: statusFor(output) })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requirePlanSimulatorScope(request)
  if (guard.error) return guard.error
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(new Output(false, [], ["Dados da cotação inválidos."], null), { status: 400 })
  const { id } = await context.params
  const output = await new PlanQuoteUseCase().update(id, guard.scope, parsed.data)
  return NextResponse.json(output, { status: statusFor(output) })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requirePlanSimulatorScope(request)
  if (guard.error) return guard.error
  const { id } = await context.params
  const output = await new PlanQuoteUseCase().delete(id, guard.scope)
  return NextResponse.json(output, { status: statusFor(output) })
}
