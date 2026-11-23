import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { AGE_BANDS, EMPTY_FILTERS } from "@/lib/planSimulator/planSimulator"
import { PlanSimulatorUseCase } from "@/app/api/useCases/planSimulator/PlanSimulatorUseCase"
import { requirePlanSimulatorScope } from "../guard"

const bodySchema = z.object({
  uf: z.string().length(2),
  lives: z.array(z.number().int().min(0).max(999)).length(AGE_BANDS.length),
  filters: z
    .object({
      acomodacoes: z.array(z.string()).max(10),
      coparticipacoes: z.array(z.string()).max(10),
      contratacoes: z.array(z.string()).max(10),
      hospitalIds: z.array(z.number().int().nonnegative()).max(30),
      mei: z.boolean(),
      respeitarMinimoVidas: z.boolean(),
      valorMin: z.number().nonnegative().nullable(),
      valorMax: z.number().nonnegative().nullable(),
    })
    .default(EMPTY_FILTERS),
})

/** Simulação: recebe vidas por faixa e filtros; devolve os planos que atendem, com total. */
export async function POST(request: NextRequest) {
  const guard = await requirePlanSimulatorScope(request)
  if (guard.error) return guard.error

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(new Output(false, [], [...new Set(parsed.error.issues.map((i) => i.message))], null), { status: 400 })
  }

  const output = await new PlanSimulatorUseCase().simulate(parsed.data)
  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}
