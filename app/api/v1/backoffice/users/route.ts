import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { BackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/BackofficeUserRepository"
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository"
import { noopMailboxProvisioningService } from "@/app/api/services/mailbox/NoopMailboxProvisioningService"
import { BackofficeUserUseCase } from "@/app/api/useCases/backoffice/BackofficeUserUseCase"

function makeUseCase() {
  return new BackofficeUserUseCase(
    new BackofficeUserRepository(),
    profileRepository,
    noopMailboxProvisioningService
  )
}

export async function GET(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const useCase = makeUseCase()
    const output = await useCase.listUsers()
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeUsersRoute][GET]", error)
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
    const output = await useCase.createUser(body, result.access)
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    console.error("[BackofficeUsersRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
