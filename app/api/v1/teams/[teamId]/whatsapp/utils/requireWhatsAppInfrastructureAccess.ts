import { NextResponse } from "next/server"
import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { canManageWhatsAppInfrastructure } from "@/lib/whatsapp/conversation-access"

export function denyIfCannotManageWhatsAppInfrastructure(access: TeamAccess) {
  if (canManageWhatsAppInfrastructure(access)) {
    return null
  }
  return NextResponse.json(
    new Output(false, [], ["Apenas gestores podem executar esta ação"], null),
    { status: 403 }
  )
}
