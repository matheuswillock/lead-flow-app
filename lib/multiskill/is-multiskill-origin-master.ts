import { cache } from "react";
import { prisma } from "@/app/api/infra/data/prisma";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import { MULTISKILL_ORIGIN_MASTER_EMAIL } from "./constants";

export const resolveMultiskillOriginMasterId = cache(async (): Promise<string | null> => {
  const profile = await prisma.profile.findUnique({
    where: { email: MULTISKILL_ORIGIN_MASTER_EMAIL },
    select: { id: true },
  });
  return profile?.id ?? null;
});

export function isMultiskillOriginMaster(
  ctx: Pick<TeamAccess, "managerId">,
  originMasterId: string | null
): boolean {
  if (!originMasterId) return false;
  return ctx.managerId === originMasterId;
}

export function isMultiskillOriginAccountMasterId(
  accountMasterId: string,
  originMasterId: string | null
): boolean {
  if (!originMasterId) return false;
  return accountMasterId === originMasterId;
}

export async function canListExternalMultiskillTargets(
  ctx: TeamAccess,
  teamId: string,
  hasMultiskillOriginTeam: (teamId: string) => Promise<boolean>
): Promise<boolean> {
  const originMasterId = await resolveMultiskillOriginMasterId();
  if (!isMultiskillOriginMaster(ctx, originMasterId)) {
    return false;
  }
  return hasMultiskillOriginTeam(teamId);
}
