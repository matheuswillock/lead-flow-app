import { prisma } from "@/app/api/infra/data/prisma"

export interface InviteLinkProfileSnapshot {
  email: string
  inviteLinkVersion: number
  deleted: boolean
}

/** Estado do perfil que decide se um link de convite ainda vale. Null se o perfil não existir. */
export async function findInviteLinkProfile(profileId: string): Promise<InviteLinkProfileSnapshot | null> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { email: true, inviteLinkVersion: true, deletedAt: true },
  })
  if (!profile) return null
  return {
    email: profile.email,
    inviteLinkVersion: profile.inviteLinkVersion,
    deleted: profile.deletedAt !== null,
  }
}

/** Versão atual do convite, gravada no token ao gerar o link. */
export async function findInviteLinkVersion(profileId: string): Promise<number | null> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { inviteLinkVersion: true },
  })
  return profile?.inviteLinkVersion ?? null
}
