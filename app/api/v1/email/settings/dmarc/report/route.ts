import { NextResponse, type NextRequest } from "next/server"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailDmarcReportUseCase } from "@/app/api/useCases/email/EmailDmarcReportUseCase"
import { Output } from "@/lib/output"

export async function POST(request: NextRequest) {
  try {
    const access = await getTeamAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })
    const output = await new EmailDmarcReportUseCase().register(await request.json(), access.access)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[EmailDmarcReportRoute][POST]", error)
    return NextResponse.json(new Output(false, [], [error instanceof Error ? error.message : "Relatório DMARC inválido"], null), { status: 400 })
  }
}
