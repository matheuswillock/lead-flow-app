import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { backofficeContractUseCase } from "@/app/api/useCases/backofficeContract/BackofficeContractUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { searchParams } = new URL(request.url)
    const isActiveParam = searchParams.get("isActive")
    const clientId = searchParams.get("clientId") ?? undefined

    const output = await backofficeContractUseCase.listContracts({
      isActive: isActiveParam === null ? undefined : isActiveParam === "true",
      clientId,
    })

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeContractsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireMasterAccess(result.access)
    if (denied) return denied

    const formData = await request.formData()
    const file = formData.get("file")
    const title = formData.get("title")
    const description = formData.get("description")
    const clientId = formData.get("clientId")

    if (!(file instanceof File)) {
      return NextResponse.json(
        new Output(false, [], ["Arquivo PDF do contrato é obrigatório"], null),
        { status: 400 }
      )
    }

    const output = await backofficeContractUseCase.createContract(
      {
        title: typeof title === "string" ? title : "",
        description: typeof description === "string" ? description : undefined,
        clientId: typeof clientId === "string" && clientId ? clientId : undefined,
      },
      file,
      result.access.profileId
    )

    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeContractsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
