import "server-only";

import { revalidateTag } from "next/cache";
import { cacheTags } from "@/lib/cache/cacheTags";

function revalidateDefinedTags(tags: Array<string | null | undefined>) {
  for (const tag of tags) {
    if (tag) {
      revalidateTag(tag, "max");
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

export function invalidateFeatureAccessCache(input: {
  profileId?: string | null;
  managerId?: string | null;
}) {
  revalidateDefinedTags([
    input.profileId ? cacheTags.featureAccess(input.profileId) : null,
    input.managerId ? cacheTags.featureAccessOwner(input.managerId) : null,
    cacheTags.backofficeFeatures(),
  ]);
}

export function invalidateTeamMembersCache(input: { teamId: string }) {
  revalidateDefinedTags([cacheTags.teamMembers(input.teamId)]);
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

export function invalidateDialerCampaignCache(input: {
  teamId: string;
  campaignId?: string | null;
}) {
  revalidateDefinedTags([
    cacheTags.dialerCampaigns(input.teamId),
    input.campaignId ? cacheTags.dialerCampaign(input.campaignId) : null,
    input.campaignId ? cacheTags.dialerCalls(input.campaignId) : null,
  ]);
}

export function invalidateDialerUsageCache(input: { teamId: string }) {
  revalidateDefinedTags([cacheTags.dialerUsage(input.teamId)]);
}

export function invalidateDialerSubscriptionCache(input: { teamId: string }) {
  revalidateDefinedTags([cacheTags.dialerSubscription(input.teamId)]);
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
    cacheTags.leadActivities(input.leadId),
    cacheTags.leadDetails(input.leadId),
  ]);
}

