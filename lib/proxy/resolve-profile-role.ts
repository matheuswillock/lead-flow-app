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

export async function resolveTermsAcceptanceForProxy(supabaseId: string): Promise<boolean> {
  const { prisma } = await import("@/app/api/infra/data/prisma")
  const profile = await prisma.profile.findUnique({
    where: { supabaseId },
    select: { id: true },
  })
  if (!profile) return false
  const { backofficeTermsAcceptanceRepository } = await import("@/app/api/infra/data/repositories/backoffice/termsAcceptance/BackofficeTermsAcceptanceRepository")
  const adhesion = await backofficeTermsAcceptanceRepository.findAccessGate(profile.id)
  return !adhesion?.termsAcceptanceRequired || Boolean(adhesion.termsAcceptance)
}
