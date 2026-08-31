import { NextResponse } from "next/server"
import { createAsaasCustomerUseCase } from "@/app/api/useCases/asaasCustomer/CreateAsaasCustomerUseCase"

export async function POST(req: Request) {
  const body = (await req.json()) as { profileId?: unknown; [key: string]: unknown }
  const { profileId, ...customerData } = body ?? {}

  if (typeof profileId !== "string" || !profileId.trim()) {
    return NextResponse.json(
      { isValid: false, successMessages: [], errorMessages: ["profileId é obrigatório"], result: null },
      { status: 400 }
    )
  }

  const output = await createAsaasCustomerUseCase.execute({
    ...customerData,
    profileId,
  } as Parameters<typeof createAsaasCustomerUseCase.execute>[0])

  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}
