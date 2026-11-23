import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { PlanSimulatorUseCase, PLAN_SIMULATOR_MESSAGES } from "@/app/api/useCases/planSimulator/PlanSimulatorUseCase"
import { requirePlanSimulatorScope } from "../../guard"

/** Detalhe do plano: regras em texto e rede credenciada. Carregado sob demanda. */
export async function GET(request: NextRequest, context: { params: Promise<{ chave: string }> }) {
  const guard = await requirePlanSimulatorScope(request)
  if (guard.error) return guard.error

  const { chave } = await context.params
  if (!/^[\w-]{1,64}$/.test(chave)) {
    return NextResponse.json(new Output(false, [], [PLAN_SIMULATOR_MESSAGES.NOT_FOUND], null), { status: 404 })
  }

  const output = await new PlanSimulatorUseCase().tableDetail(chave)
  const status = output.isValid ? 200 : output.errorMessages.includes(PLAN_SIMULATOR_MESSAGES.NOT_FOUND) ? 404 : 500
  return NextResponse.json(output, { status })
}
