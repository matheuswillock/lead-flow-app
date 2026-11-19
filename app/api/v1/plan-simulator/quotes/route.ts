import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { PlanQuoteUseCase } from "@/app/api/useCases/planSimulator/PlanQuoteUseCase"
import { requirePlanSimulatorScope } from "../guard"

const createSchema = z.object({ nome: z.string().min(1).max(200), state: z.unknown() })

/** Cotações do corretor logado (escopo: time + dono). */
export async function GET(request: NextRequest) {
  const guard = await requirePlanSimulatorScope(request)
  if (guard.error) return guard.error
  const output = await new PlanQuoteUseCase().list(guard.scope)
  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}

export async function POST(request: NextRequest) {
  const guard = await requirePlanSimulatorScope(request)
  if (guard.error) return guard.error

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(new Output(false, [], ["Dados da cotação inválidos."], null), { status: 400 })

  const output = await new PlanQuoteUseCase().create(guard.scope, parsed.data)
  return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
}
