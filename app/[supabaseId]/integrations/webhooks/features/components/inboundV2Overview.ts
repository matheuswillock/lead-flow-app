import { pickNextAssignee } from "@/lib/webhooks/inbound/v2/roundRobin";
import type { TeamMemberOption } from "../services/ITeamWebhooksService";

const SCOPE_LABELS: Record<string, string> = {
  leads_create: "Criar leads",
  leads_schedule: "Agendar reuniões",
};

/** Escopos em linguagem clara; um escopo desconhecido aparece como veio, para não esconder nada. */
export function describeScopes(scopes: readonly string[]): string[] {
  return scopes.map((scope) => SCOPE_LABELS[scope] ?? scope);
}

export type OverviewAssignee = {
  profileId: string;
  name: string;
  /** Quem recebe o próximo lead deste webhook. */
  isNext: boolean;
};

/**
 * SDRs na ordem do rodízio, com o nome e a marca de quem recebe o próximo lead. Reusa `pickNextAssignee`,
 * a mesma função que o servidor usa, para a tela nunca divergir do que acontece de fato. Quem saiu do time
 * continua listado (sem nome) e o rodízio o pula, como no servidor.
 */
export function buildOverviewAssignees(input: {
  assigneeProfileIds: readonly string[];
  lastAssignedProfileId: string | null;
  members: readonly TeamMemberOption[];
}): OverviewAssignee[] {
  const names = new Map(input.members.map((member) => [member.profileId, member.name]));
  const next = pickNextAssignee({
    ordered: input.assigneeProfileIds,
    lastAssignedId: input.lastAssignedProfileId,
    validIds: new Set(input.members.map((member) => member.profileId)),
  });
  return input.assigneeProfileIds.map((profileId) => ({
    profileId,
    name: names.get(profileId) ?? "Fora do time",
    isNext: profileId === next,
  }));
}

/** Nome sugerido para o webhook v2 criado a partir de um v1. */
export function suggestV2Name(v1Name: string): string {
  const base = v1Name.trim();
  return /\bv2\b/i.test(base) ? base : `${base} (v2)`;
}

export function buildCreateV2Href(inboundListPath: string, v1Name: string): string {
  return `${inboundListPath}/new?from_name=${encodeURIComponent(suggestV2Name(v1Name))}`;
}
