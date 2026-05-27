import { prisma } from "@/app/api/infra/data/prisma";
import { isGoogleConnectionActive } from "@/lib/google/connection";

export type ParticipantDispatchGroups = {
  all: string[];
  googleEligible: string[];
  resendRequired: string[];
  internalConnected: string[];
  internalDisconnected: string[];
  externalOrUnknown: string[];
};

type ResolveParticipantDispatchParams = {
  teamId: string;
  emails: Array<string | null | undefined>;
};

export const buildUniqueEmails = (emails: Array<string | null | undefined>) => {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const email of emails) {
    if (!email) continue;
    const normalized = email.trim().toLowerCase();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
};

export const resolveParticipantDispatchGroups = async ({
  teamId,
  emails,
}: ResolveParticipantDispatchParams): Promise<ParticipantDispatchGroups> => {
  const all = buildUniqueEmails(emails);
  if (all.length === 0) {
    return {
      all,
      googleEligible: [],
      resendRequired: [],
      internalConnected: [],
      internalDisconnected: [],
      externalOrUnknown: [],
    };
  }

  const teamMembers = await prisma.teamMember.findMany({
    where: {
      teamId,
      profile: {
        email: {
          in: all,
          mode: "insensitive",
        },
      },
    },
    select: {
      profile: {
        select: {
          email: true,
          googleConnection: {
            select: {
              refreshToken: true,
              revokedAt: true,
            },
          },
        },
      },
    },
  });

  const memberByEmail = new Map<
    string,
    { googleCalendarConnected: boolean; googleRefreshToken: string | null }
  >();
  for (const member of teamMembers) {
    if (!member.profile.email) continue;
    const key = member.profile.email.trim().toLowerCase();
    if (!key || memberByEmail.has(key)) continue;
    memberByEmail.set(key, {
      googleCalendarConnected: isGoogleConnectionActive(member.profile.googleConnection),
      googleRefreshToken: member.profile.googleConnection?.refreshToken ?? null,
    });
  }

  const googleEligible: string[] = [];
  const resendRequired: string[] = [];
  const internalConnected: string[] = [];
  const internalDisconnected: string[] = [];
  const externalOrUnknown: string[] = [];

  for (const email of all) {
    const member = memberByEmail.get(email);
    if (!member) {
      resendRequired.push(email);
      externalOrUnknown.push(email);
      continue;
    }

    const isConnected = member.googleCalendarConnected && !!member.googleRefreshToken;
    if (isConnected) {
      googleEligible.push(email);
      internalConnected.push(email);
      continue;
    }

    resendRequired.push(email);
    internalDisconnected.push(email);
  }

  return {
    all,
    googleEligible,
    resendRequired,
    internalConnected,
    internalDisconnected,
    externalOrUnknown,
  };
};
