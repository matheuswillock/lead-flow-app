import { NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { accountAccessDecisionUseCase } from "@/app/api/useCases/accountAccessDecision/AccountAccessDecisionUseCase"

export async function requireActiveAccountAccess(
  authenticatedSupabaseId: string
): Promise<NextResponse | null> {
  const output = await accountAccessDecisionUseCase.executeForAuthenticatedSupabaseId(
    authenticatedSupabaseId
  )

  if (!output.isValid) {
    return NextResponse.json(new Output(false, [], ["Acesso negado"], null), { status: 403 })
  }

  if (output.result?.state === "restricted") {
    return NextResponse.json(
      new Output(false, [], ["O acesso desta conta está pausado."], null),
      { status: 403 }
    )
  }

  return null
}
