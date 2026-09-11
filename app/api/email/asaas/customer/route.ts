import { NextResponse } from "next/server"
import { createAsaasCustomerUseCase } from "@/app/api/useCases/asaasCustomer/CreateAsaasCustomerUseCase"

// E7 de [[40 — Checkout, Adesões e Add-ons — Backend]] (m8): rota sem
// consumidor vivo encontrado no repo (grep, Postman só documenta) e sem
// nenhuma checagem de autenticação — qualquer requisição não autenticada
// podia criar customer Asaas para um profileId arbitrário. Autenticação
// mínima (mesmo padrão de CRON_SECRET usado por rotas internas do repo)
// como hardening reversível enquanto a remoção definitiva aguarda
// autorização do owner (Open question 6 de [[40]]).
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { isValid: false, successMessages: [], errorMessages: ["Não autorizado"], result: null },
      { status: 401 }
    )
  }

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
