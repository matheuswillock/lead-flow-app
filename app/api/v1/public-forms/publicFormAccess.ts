import { NextResponse } from "next/server"
import { publicFormAccountAccessUseCase } from "@/app/api/useCases/publicForms/PublicFormAccountAccessUseCase"

function accessErrorStatus(errorMessages: string[]): number {
  return errorMessages.includes("Formulário indisponível") ? 404 : 403
}

export async function rejectRestrictedPublicForm(publicId: string): Promise<NextResponse | null> {
  const access = await publicFormAccountAccessUseCase.execute(publicId)
  if (access.isValid) return null

  return NextResponse.json(access, { status: accessErrorStatus(access.errorMessages) })
}

export async function rejectRestrictedPublicFormTeam(teamId: string): Promise<NextResponse | null> {
  const access = await publicFormAccountAccessUseCase.executeForTeam(teamId)
  if (access.isValid) return null

  return NextResponse.json(access, { status: 403 })
}
