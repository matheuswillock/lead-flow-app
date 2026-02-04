import { prisma } from "@/app/api/infra/data/prisma";

export const BILLING_PRICES = {
  base: 59.9,
  extraTeam: 29.9,
  extraUser: 19.9,
};

export type BillingSummary = {
  masterId: string;
  teamCount: number;
  distinctUserCount: number;
  totalUsersIncludingMaster: number;
  billableTeams: number;
  billableUsers: number;
  basePrice: number;
  extraTeamsPrice: number;
  extraUsersPrice: number;
  totalPrice: number;
  hasPermanentSubscription: boolean;
};

export async function getBillingSummary(masterId: string): Promise<BillingSummary> {
  const master = await prisma.profile.findUnique({
    where: { id: masterId },
    select: { id: true, hasPermanentSubscription: true },
  });

  if (!master) {
    throw new Error("Master não encontrado");
  }

  const teamCount = await prisma.team.count({
    where: { masterId },
  });

  const teamMembers = await prisma.teamMember.findMany({
    where: {
      team: { masterId },
    },
    select: { profileId: true },
    distinct: ["profileId"],
  });

  const distinctUserCount = teamMembers.filter((member) => member.profileId !== masterId).length;
  const totalUsersIncludingMaster = distinctUserCount + 1;

  const billableTeams = Math.max(0, teamCount - 1);
  const billableUsers = Math.max(0, totalUsersIncludingMaster - 1);

  const basePrice = BILLING_PRICES.base;
  const extraTeamsPrice = billableTeams * BILLING_PRICES.extraTeam;
  const extraUsersPrice = billableUsers * BILLING_PRICES.extraUser;
  const totalPrice = basePrice + extraTeamsPrice + extraUsersPrice;

  return {
    masterId,
    teamCount,
    distinctUserCount,
    totalUsersIncludingMaster,
    billableTeams,
    billableUsers,
    basePrice,
    extraTeamsPrice,
    extraUsersPrice,
    totalPrice: master.hasPermanentSubscription ? 0 : Number(totalPrice.toFixed(2)),
    hasPermanentSubscription: master.hasPermanentSubscription,
  };
}
