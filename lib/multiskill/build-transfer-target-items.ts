import type { ListTransferTargetsResult, TransferTargetItem } from "./transfer-target-types";

type InternalTransferTarget = {
  teamId: string;
  teamName: string;
};

type ExternalTransferMember = {
  profileId: string;
  fullName: string | null;
  email: string;
  googleCalendarConnected?: boolean;
};

type ExternalTransferTarget = {
  masterId: string;
  masterName: string | null;
  masterEmail: string;
  defaultTeamId: string;
  defaultTeamName: string;
  closers: ExternalTransferMember[];
  sdrs?: ExternalTransferMember[];
};

function mapMemberRef(member: ExternalTransferMember) {
  return {
    profileId: member.profileId,
    fullName: member.fullName,
    email: member.email,
    googleCalendarConnected: member.googleCalendarConnected ?? false,
  };
}

function sortTransferTargetItems(items: TransferTargetItem[]): TransferTargetItem[] {
  return [...items].sort((a, b) => {
    const aLabel =
      a.mode === "multiskill"
        ? `${a.teamName} ${a.masterName ?? a.masterEmail ?? ""}`
        : a.teamName;
    const bLabel =
      b.mode === "multiskill"
        ? `${b.teamName} ${b.masterName ?? b.masterEmail ?? ""}`
        : b.teamName;
    return aLabel.localeCompare(bLabel, "pt-BR");
  });
}

export function buildTransferTargetItems(input: {
  internalTargets: InternalTransferTarget[];
  externalTargets: ExternalTransferTarget[] | null;
  canExternalMultiskill: boolean;
  page: number;
  pageSize: number;
}): ListTransferTargetsResult {
  const items: TransferTargetItem[] = input.internalTargets.map((target) => ({
    teamId: target.teamId,
    teamName: target.teamName,
    mode: "internal",
  }));

  if (input.canExternalMultiskill && input.externalTargets) {
    for (const target of input.externalTargets) {
      items.push({
        teamId: target.defaultTeamId,
        teamName: target.defaultTeamName,
        mode: "multiskill",
        masterId: target.masterId,
        masterName: target.masterName,
        masterEmail: target.masterEmail,
        closers: target.closers.map(mapMemberRef),
        sdrs: (target.sdrs ?? []).map(mapMemberRef),
      });
    }
  }

  const sortedItems = sortTransferTargetItems(items);
  const page = Math.max(input.page, 1);
  const pageSize = Math.min(100, Math.max(input.pageSize, 1));
  const totalItems = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (page - 1) * pageSize;

  return {
    items: sortedItems.slice(start, start + pageSize),
    canExternalMultiskill: input.canExternalMultiskill,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
