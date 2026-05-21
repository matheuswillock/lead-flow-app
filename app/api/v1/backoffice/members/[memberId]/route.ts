import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeMemberUseCase } from "@/app/api/useCases/backoffice/BackofficeMemberUseCase"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const { memberId } = await params
    const body = await request.json().catch(() => ({}))

    const optionalString = (v: unknown): string | undefined =>
      typeof v === "string" ? v : undefined
    const nullableString = (v: unknown): string | null | undefined => {
      if (v === null) return null
      if (typeof v === "string") {
        const trimmed = v.trim()
        return trimmed === "" ? null : trimmed
      }
      return undefined
    }

    const data = {
      fullName: optionalString(body.fullName),
      phone: nullableString(body.phone),
      email: optionalString(body.email),
    }

    const output = await backofficeMemberUseCase.updateMember(memberId, data)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeMemberByIdRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const { memberId } = await params
    const body = await request.json().catch(() => ({}))
    const password = typeof body.password === "string" ? body.password : ""

    const output = await backofficeMemberUseCase.deleteMember(
      memberId,
      accessResult.access.profileId,
      password
    )

    let status = 200
    if (!output.isValid) {
      const firstError = output.errorMessages[0] ?? ""
      if (firstError === "Senha incorreta") status = 401
      else if (firstError === "Membro não encontrado") status = 404
      else if (firstError === "Usuário admin não encontrado") status = 403
      else status = 400
    }

    return NextResponse.json(output, { status })
  } catch (error) {
    console.error("[BackofficeMemberByIdRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
