import { teamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository";
import type { ITeamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/ITeamMembersRepository";

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

export const resolveParticipantDispatchGroups = async (
  { teamId, emails }: ResolveParticipantDispatchParams,
  // SPEC 13 (Agenda na Criação de Lead), A-E3 — "participantDispatch passa a
  // ler membros por repositório" (DA9): a leitura direta ao banco (Prisma,
  // tabela de membros do time) saiu para
  // `ITeamMembersRepository.findGoogleConnectionStatusByEmails`. O singleton
  // concreto só como valor padrão preserva os call sites de produção.
  teamMembersRepo: ITeamMembersRepository = teamMembersRepository
): Promise<ParticipantDispatchGroups> => {
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

  const teamMembers = await teamMembersRepo.findGoogleConnectionStatusByEmails(teamId, all);

  const memberByEmail = new Map<string, { googleCalendarConnected: boolean }>();
  for (const member of teamMembers) {
    const key = member.email.trim().toLowerCase();
    if (!key || memberByEmail.has(key)) continue;
    memberByEmail.set(key, { googleCalendarConnected: member.googleCalendarConnected });
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

    if (member.googleCalendarConnected) {
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
