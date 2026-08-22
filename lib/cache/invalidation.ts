import "server-only";

import { revalidateTag } from "next/cache";
import { cacheTags } from "@/lib/cache/cacheTags";

function revalidateDefinedTags(tags: Array<string | null | undefined>) {
  for (const tag of tags) {
    if (!tag) continue;

    try {
      revalidateTag(tag, "max");
    } catch (error) {
      // Fora de um work store do Next (scripts CLI, seeds, workers) o revalidateTag
      // lanca "Invariant: static generation store missing". Nesses contextos nao existe
      // Data Cache para invalidar, entao ignorar e o comportamento correto — e uma tag
      // que falha nao pode abortar as seguintes.
      console.warn(`[CacheInvalidation] revalidateTag ignorado fora de request: ${tag}`, error);
    }
  }
}

export function invalidateLeadCache(input: {
  leadId: string;
  teamId: string;
  previousTeamId?: string | null;
}) {
  const teamTags = [input.teamId, input.previousTeamId]
    .filter((teamId): teamId is string => Boolean(teamId))
    .flatMap((teamId) => [
      cacheTags.teamLeads(teamId),
      // Uma alteracao de lead pode mover meetingDate, que e exatamente o que o
      // calendario renderiza — por isso teamCalendar entra junto de teamLeads.
      cacheTags.teamCalendar(teamId),
      cacheTags.teamDashboard(teamId),
      cacheTags.teamPerformance(teamId),
    ]);

  revalidateDefinedTags([
    cacheTags.lead(input.leadId),
    cacheTags.leadDetails(input.leadId),
    ...teamTags,
  ]);
}

export function invalidateLeadFullCache(input: {
  leadId: string;
  teamId: string;
  previousTeamId?: string | null;
}) {
  invalidateLeadCache(input);
  revalidateDefinedTags([
    cacheTags.leadActivities(input.leadId),
    cacheTags.leadSchedules(input.leadId),
  ]);
}

export function invalidateTeamCalendarCache(input: { teamId: string; leadId?: string | null }) {
  revalidateDefinedTags([
    cacheTags.teamCalendar(input.teamId),
    cacheTags.teamDashboard(input.teamId),
    cacheTags.teamPerformance(input.teamId),
    input.leadId ? cacheTags.lead(input.leadId) : null,
    input.leadId ? cacheTags.leadDetails(input.leadId) : null,
    input.leadId ? cacheTags.leadSchedules(input.leadId) : null,
  ]);
}

export function invalidatePortfolioCache(input: { teamId: string; leadId?: string | null }) {
  revalidateDefinedTags([
    cacheTags.portfolio(input.teamId),
    input.leadId ? cacheTags.portfolioDetail(input.leadId) : null,
  ]);
}

export function invalidateAccountAccessStatusCache(input: { accountMasterId: string }) {
  revalidateDefinedTags([cacheTags.accountAccessStatus(input.accountMasterId)]);
}

export function invalidateFeatureAccessCache(input: {
  profileId?: string | null;
  managerId?: string | null;
}) {
  revalidateDefinedTags([
    input.profileId ? cacheTags.featureAccessProfile(input.profileId) : null,
    input.managerId ? cacheTags.featureAccessOwner(input.managerId) : null,
    cacheTags.backofficeFeatures(),
  ]);
}

export function invalidateTeamMembersCache(input: { teamId: string }) {
  revalidateDefinedTags([cacheTags.teamMembers(input.teamId)]);
}

/**
 * Invalida o bootstrap do formulario publico.
 *
 * Só e necessario para os dados que o bootstrap cacheia e que NAO estao cobertos
 * pelas tags co-declaradas em getCachedPublicFormBootstrap (`healthPlans` e
 * `teamMembers`): definicoes de campos customizados, rotas de transferencia
 * (`hasTransferTargets`), nome do time e timezone do master.
 */
export function invalidatePublicFormBootstrapCache(input: { teamId: string }) {
  revalidateDefinedTags([cacheTags.publicFormBootstrap(input.teamId)]);
}

export function invalidateHealthPlansCache() {
  revalidateDefinedTags([cacheTags.healthPlans()]);
}

export function invalidateBackofficeFeaturesCache() {
  revalidateDefinedTags([cacheTags.backofficeFeatures()]);
}

export function invalidateTeamStatusRulesCache(input: { teamId: string }) {
  revalidateDefinedTags([cacheTags.teamStatusRules(input.teamId)]);
}

export function invalidateLeadStatusTransitionFieldRulesCache() {
  revalidateDefinedTags([cacheTags.leadStatusTransitionFieldRules()]);
}

export function invalidateLeadStatusTransitionGatesCache() {
  revalidateDefinedTags([cacheTags.leadStatusTransitionGates()]);
}

export function invalidateTeamLeadsCache(input: { teamId: string }) {
  revalidateDefinedTags([
    cacheTags.teamLeads(input.teamId),
    cacheTags.teamDashboard(input.teamId),
    cacheTags.teamPerformance(input.teamId),
  ]);
}

export function invalidateLeadActivitiesCache(input: { leadId: string }) {
  revalidateDefinedTags([
    cacheTags.lead(input.leadId),
    cacheTags.leadActivities(input.leadId),
    cacheTags.leadDetails(input.leadId),
  ]);
}

export function invalidateTeamTasksCache(input: { teamId: string }) {
  revalidateDefinedTags([cacheTags.teamTasks(input.teamId)]);
}

export function invalidateTeamFilterPresetsCache(input: {
  teamId: string;
  profileId: string;
  scope: string;
}) {
  revalidateDefinedTags([cacheTags.teamFilterPresets(input.teamId, input.profileId, input.scope)]);
}

export function invalidateNotificationsCache(input: { recipientProfileIds: string[] }) {
  revalidateDefinedTags(
    input.recipientProfileIds.map((profileId) => cacheTags.notifications(profileId))
  );
}

export function invalidateRadarSegmentsCache(input: { teamId: string }) {
  revalidateDefinedTags([cacheTags.radarSegments(input.teamId)]);
}
