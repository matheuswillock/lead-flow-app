import { NextRequest, NextResponse } from "next/server"
import { PlanQuoteUseCase, PLAN_QUOTE_MESSAGES } from "@/app/api/useCases/planSimulator/PlanQuoteUseCase"
import { requirePlanSimulatorScope } from "../../../guard"

/** Gera o link do cliente (snapshot imutável). Devolve só o token; a URL pública é montada no cliente. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requirePlanSimulatorScope(request)
  if (guard.error) return guard.error
  const { id } = await context.params
  const output = await new PlanQuoteUseCase().share(id, guard.scope)
  const status = output.isValid
    ? 201
    : output.errorMessages.includes(PLAN_QUOTE_MESSAGES.NOT_FOUND)
      ? 404
      : 400
  return NextResponse.json(output, { status })
}
