import { prisma } from "@/app/api/infra/data/prisma"

export async function isAccountMasterBanned(masterProfileId: string): Promise<boolean> {
  const ban = await prisma.backofficeBannedUser.findFirst({
    where: {
      profileId: masterProfileId,
      status: "ACTIVE",
      scope: "ACCOUNT",
    },
    select: { id: true },
  })

  return ban !== null
}

export async function findActiveAccountBannedMasterIds(
  masterProfileIds: string[]
): Promise<Set<string>> {
  if (masterProfileIds.length === 0) {
    return new Set()
  }

  const uniqueIds = [...new Set(masterProfileIds)]
  const bans = await prisma.backofficeBannedUser.findMany({
    where: {
      profileId: { in: uniqueIds },
      status: "ACTIVE",
      scope: "ACCOUNT",
    },
    select: { profileId: true },
  })

  return new Set(bans.map((ban) => ban.profileId))
}

export async function isProfileIndividuallyBanned(profileId: string): Promise<boolean> {
  const ban = await prisma.backofficeBannedUser.findFirst({
    where: {
      profileId,
      status: "ACTIVE",
      scope: "INDIVIDUAL",
    },
    select: { id: true },
  })

  return ban !== null
}

export const ACCOUNT_MASTER_BANNED_MESSAGE =
  "O acesso a esta conta foi suspenso. Entre em contato com o administrador."
