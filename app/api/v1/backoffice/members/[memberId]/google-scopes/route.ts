import type { NextRequest } from "next/server"
import { NextResponse, connection } from "next/server";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { getMemberGoogleScopesUseCase } from "@/app/api/useCases/backoffice/GetMemberGoogleScopesUseCase"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  await connection();

  const { memberId } = await params

  const accessResult = await getBackofficeAccess(request)
  if (accessResult.error) {
    return NextResponse.json(accessResult.error, { status: accessResult.status })
  }

  const output = await getMemberGoogleScopesUseCase(memberId)

  if (!output.isValid) {
    return NextResponse.json(output, { status: 404 })
  }

  return NextResponse.json(output)
}
