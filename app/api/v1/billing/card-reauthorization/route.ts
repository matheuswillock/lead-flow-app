import { connection, NextResponse, type NextRequest } from "next/server"
import { createAuthenticatedCardReauthorizationLinkUseCase } from "@/app/api/useCases/asaasAccountMigration/authenticatedCardReauthorizationFactory"
import { getAuthenticatedSupabaseId } from "@/app/api/v1/utils/getAuthenticatedSupabaseId"

export async function POST(request: NextRequest) {
  await connection()
  const authentication = await getAuthenticatedSupabaseId(request)
  if ("error" in authentication) {
    return NextResponse.json(authentication.error, { status: authentication.status })
  }

  const output = await createAuthenticatedCardReauthorizationLinkUseCase.execute(authentication)
  return NextResponse.json(output, { status: output.isValid ? 200 : 409 })
}
