import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailContactListUseCase } from "@/app/api/useCases/email/EmailContactListUseCase"
import { isManagerLikeRole } from "@/lib/roles"

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

function makeUseCase() {
  return new EmailContactListUseCase()
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem importar contatos"], null),
        { status: 403 }
      )
    }

    const formData = await request.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json(new Output(false, [], ["Dados do formulário inválidos"], null), { status: 400 })
    }

    const file = formData.get("file")
    if (!file || typeof file === "string") {
      return NextResponse.json(new Output(false, [], ["Arquivo CSV é obrigatório"], null), { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        new Output(false, [], ["Arquivo muito grande. Tamanho máximo: 10MB"], null),
        { status: 400 }
      )
    }

    const contentType = file.type
    if (contentType && !contentType.includes("csv") && !contentType.includes("text")) {
      return NextResponse.json(
        new Output(false, [], ["Formato inválido. Envie um arquivo CSV"], null),
        { status: 400 }
      )
    }

    const csvContent = await file.text()
    if (!csvContent.trim()) {
      return NextResponse.json(new Output(false, [], ["Arquivo CSV está vazio"], null), { status: 400 })
    }

    const useCase = makeUseCase()
    const output = await useCase.uploadCsv(id, csvContent, teamAccess.access)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[EmailContactListUploadRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno ao processar arquivo"], null), { status: 500 })
  }
}
