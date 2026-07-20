import { NextRequest, NextResponse } from "next/server"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import { Output } from "@/lib/output"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; leadId: string }> },
) {
  const access = await getTeamAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const { teamId, leadId } = await params
  if (teamId !== access.access.teamId) {
    return NextResponse.json(new Output(false, [], ["Acesso negado"], null), { status: 403 })
  }
  const output = await publicFormsUseCase.leadSubmissions(access.access, leadId)
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
}
