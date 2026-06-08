import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import {
  backofficeProfileUserTypeUseCase,
  type BackofficeProfileUserTypeInput,
} from "@/app/api/useCases/backoffice/BackofficeProfileUserTypeUseCase"

const USER_TYPE_VALUES = ["common", "member_pro"] as const

function parseUserType(value: unknown): BackofficeProfileUserTypeInput["userType"] | undefined {
  return (USER_TYPE_VALUES as readonly unknown[]).includes(value)
    ? (value as BackofficeProfileUserTypeInput["userType"])
    : undefined
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    if (!result.access.fullAccess) {
      return NextResponse.json(new Output(false, [], ["Acesso negado"], null), { status: 403 })
    }

    const { profileId } = await params
    const body = await request.json()

    const userType = parseUserType(body?.userType)
    if (!userType) {
      return NextResponse.json(new Output(false, [], ["Tipo de usuário inválido"], null), { status: 400 })
    }

    const input: BackofficeProfileUserTypeInput = {
      userType,
      accessExpiresAt: typeof body.accessExpiresAt === "string" ? body.accessExpiresAt : undefined,
    }

    const output = await backofficeProfileUserTypeUseCase.convert(profileId, result.access.profileId, input)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeProfileUserTypeRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
