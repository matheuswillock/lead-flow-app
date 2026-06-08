import { PrismaClient, UserFunction, UserRole } from "@prisma/client";

type SeedAuthUser = {
  id: string;
  email?: string | null;
};

function deriveFullNameFromEmail(email: string): string {
  const localPart = email.split("@")[0]?.trim() || email;
  const normalized = localPart.replace(/[._-]+/g, " ").trim();

  if (!normalized) {
    return email;
  }

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

async function ensureDefaultTeamForMaster(
  prisma: PrismaClient,
  profileId: string,
  functions: UserFunction[],
) {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { activeTeamId: true, isMaster: true },
  });

  if (!profile?.isMaster) {
    return;
  }

  const existingDefaultTeam = await prisma.team.findFirst({
    where: { masterId: profileId, isDefault: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const team =
    existingDefaultTeam ??
    (await prisma.team.create({
      data: {
        name: "Meu Time",
        masterId: profileId,
        isDefault: true,
      },
      select: { id: true },
    }));

  await prisma.teamMember.upsert({
    where: {
      teamId_profileId: {
        teamId: team.id,
        profileId,
      },
    },
    create: {
      teamId: team.id,
      profileId,
      role: UserRole.manager,
      functions,
    },
    update: {
      role: UserRole.manager,
      functions,
    },
  });

  if (!profile.activeTeamId) {
    await prisma.profile.update({
      where: { id: profileId },
      data: { activeTeamId: team.id },
    });
  }
}

export async function ensureAppSeedProfile(prisma: PrismaClient, user: SeedAuthUser) {
  const email = user.email?.trim().toLowerCase();
  if (!email) {
    throw new Error(`[seed:profiles] Usuário ${user.id} sem e-mail não pode gerar profile`);
  }

  const functions: UserFunction[] = [UserFunction.SDR, UserFunction.CLOSER];
  const profileData = {
    email,
    supabaseId: user.id,
    fullName: deriveFullNameFromEmail(email),
    role: UserRole.manager,
    isMaster: true,
    functions,
  };

  const profileBySupabaseId = await prisma.profile.findUnique({
    where: { supabaseId: user.id },
    select: { id: true },
  });

  if (profileBySupabaseId) {
    await prisma.profile.update({
      where: { id: profileBySupabaseId.id },
      data: profileData,
    });
    await ensureDefaultTeamForMaster(prisma, profileBySupabaseId.id, functions);
    return profileBySupabaseId.id;
  }

  const profileByEmail = await prisma.profile.findUnique({
    where: { email },
    select: { id: true },
  });

  if (profileByEmail) {
    await prisma.profile.update({
      where: { id: profileByEmail.id },
      data: profileData,
    });
    await ensureDefaultTeamForMaster(prisma, profileByEmail.id, functions);
    return profileByEmail.id;
  }

  const profile = await prisma.profile.create({
    data: profileData,
    select: { id: true },
  });

  await ensureDefaultTeamForMaster(prisma, profile.id, functions);
  return profile.id;
}
