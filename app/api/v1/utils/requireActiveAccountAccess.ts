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

export async function requireWritableAccountAccess(
  authenticatedSupabaseId: string,
): Promise<NextResponse | null> {
  const output = await accountAccessDecisionUseCase.executeForAuthenticatedSupabaseId(
    authenticatedSupabaseId,
  )

  if (!output.isValid || output.result?.state !== "allowed") {
    return NextResponse.json(
      new Output(
        false,
        [],
        ["Acesso somente leitura: regularize o pagamento para alterar sua conta."],
        null,
      ),
      { status: 403 },
    )
  }

  return null
}
