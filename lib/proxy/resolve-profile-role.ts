import type { UserRole } from "@prisma/client"

export async function resolveProfileRoleForProxy(
  supabaseId: string,
): Promise<{ role: UserRole } | null> {
  const { prisma } = await import("@/app/api/infra/data/prisma")
  return prisma.profile.findUnique({
    where: { supabaseId },
    select: { role: true },
  })
}
