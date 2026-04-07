import type { NextRequest } from "next/server"
import { prisma } from "@/app/api/infra/data/prisma"
import { Output } from "@/lib/output"
import { isBackofficeRole } from "@/lib/roles"

export type BackofficeAccess = {
  supabaseId: string
  profileId: string
  fullAccess: boolean
}

export type BackofficeAccessResult =
  | { access: BackofficeAccess; error?: never; status?: never }
  | { access?: never; error: Output; status: number }

export async function getBackofficeAccess(
  request: NextRequest
): Promise<BackofficeAccessResult> {
  const supabaseId = request.headers.get("x-supabase-user-id")

  if (!supabaseId) {
    return {
      error: new Output(false, [], ["Não autenticado"], null),
      status: 401,
    }
  }

  const profile = await prisma.profile.findUnique({
    where: { supabaseId },
    select: {
      id: true,
      role: true,
      backofficeUser: {
        select: { fullAccess: true, isActive: true },
      },
    },
  })

  if (!profile || !isBackofficeRole(profile.role)) {
    return {
      error: new Output(false, [], ["Acesso negado"], null),
      status: 403,
    }
  }

  if (profile.backofficeUser && !profile.backofficeUser.isActive) {
    return {
      error: new Output(false, [], ["Usuário backoffice inativo"], null),
      status: 403,
    }
  }

  return {
    access: {
      supabaseId,
      profileId: profile.id,
      fullAccess: profile.backofficeUser?.fullAccess ?? false,
    },
  }
}
