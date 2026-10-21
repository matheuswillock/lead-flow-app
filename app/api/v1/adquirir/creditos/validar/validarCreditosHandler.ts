import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { isManagerLikeRole } from "@/lib/roles"
import type { TeamAccessResult } from "@/app/api/v1/utils/teamAccess"
import type { IValidarEmailCreditosUseCase } from "@/app/api/useCases/adquirir/ValidarEmailCreditosUseCase"

export type ValidarCreditosHandlerDeps = {
  getTeamAccess(request: NextRequest): Promise<TeamAccessResult>
  validarCreditos: IValidarEmailCreditosUseCase
}

function reject(message: string, status: number) {
  return NextResponse.json(new Output(false, [], [message], null), { status })
}

// A compra pertence ao usuário autenticado; o body só escolhe o plano.
export async function handleValidarCreditos(request: NextRequest, deps: ValidarCreditosHandlerDeps) {
  const teamAccess = await deps.getTeamAccess(request)
  if (teamAccess.error) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status })
  }
  if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
    return reject("Apenas managers podem contratar créditos de e-mail", 403)
  }

  const body = (await request.json().catch(() => null)) as { plan?: unknown } | null
  if (typeof body?.plan !== "string") {
    return reject("Informe um plano.", 400)
  }

  const output = await deps.validarCreditos.execute({
    plan: body.plan as "25k" | "50k",
    access: teamAccess.access,
  })
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
}
