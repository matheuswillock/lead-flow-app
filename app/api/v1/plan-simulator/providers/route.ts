import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { PlanSimulatorUseCase } from "@/app/api/useCases/planSimulator/PlanSimulatorUseCase"
import { requirePlanSimulatorScope } from "../guard"

const querySchema = z.object({
  q: z.string().max(80).default(""),
  uf: z.string().length(2).nullable().default(null),
})

/** Busca de hospital para o filtro de rede de referência. */
export async function GET(request: NextRequest) {
  const guard = await requirePlanSimulatorScope(request)
  if (guard.error) return guard.error

  const parsed = querySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
    uf: request.nextUrl.searchParams.get("uf"),
  })
  if (!parsed.success) return NextResponse.json(new Output(false, [], ["Busca inválida."], null), { status: 400 })

  const output = await new PlanSimulatorUseCase().searchProviders(parsed.data.q, parsed.data.uf)
  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}
