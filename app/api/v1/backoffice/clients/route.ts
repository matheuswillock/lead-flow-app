import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { BackofficeClientRepository } from "@/app/api/infra/data/repositories/backoffice/BackofficeClientRepository"
import { BackofficePlatformUsersRepository } from "@/app/api/infra/data/repositories/backoffice/BackofficePlatformUsersRepository"
import { AsaasCustomerService } from "@/app/api/services/AsaasCustomer/AsaasCustomerService"
import { BackofficeClientUseCase } from "@/app/api/useCases/backoffice/BackofficeClientUseCase"
import { BackofficePlatformUsersUseCase } from "@/app/api/useCases/backoffice/BackofficePlatformUsersUseCase"

function makeUseCase() {
  return new BackofficeClientUseCase(
    new BackofficeClientRepository(),
    new AsaasCustomerService()
  )
}

function makePlatformUsersUseCase() {
  return new BackofficePlatformUsersUseCase(new BackofficePlatformUsersRepository())
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

export async function GET(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { searchParams } = new URL(request.url)
    const view = searchParams.get("view")

    if (view === "platform-users") {
      const query = searchParams.get("q") ?? undefined
      const page = parsePositiveInt(searchParams.get("page"), 1)
      const pageSize = Math.max(parsePositiveInt(searchParams.get("pageSize"), 10), 5)
      const filters = {
        name: query,
        email: query,
        team: query,
      }
      const platformUsersUseCase = makePlatformUsersUseCase()
      const output = await platformUsersUseCase.listMasterUsers(filters, { page, pageSize })
      return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
    }

    const useCase = makeUseCase()
    const output = await useCase.listClients()
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeClientsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const body = await request.json()
    const useCase = makeUseCase()
    const output = await useCase.createClient(body, result.access.profileId)
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    console.error("[BackofficeClientsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
