import { Output } from "@/lib/output";
import { MEETING_FOLLOW_UP_DAYS } from "@/lib/lead-meeting";
import { getFullUrl } from "@/lib/utils/app-url";
import {
  meetingFollowUpRepository,
  type MeetingFollowUpLeadRow,
} from "@/app/api/infra/data/repositories/meetingFollowUp/MeetingFollowUpRepository";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { emailService } from "@/lib/services/EmailService";

type DigestRecipientRole = "closer" | "master";

type DigestGroup = {
  teamId: string;
  recipientProfileId: string;
  role: DigestRecipientRole;
  leadCount: number;
};

function buildDigestGroups(
  leads: MeetingFollowUpLeadRow[],
  teamMasterById: Map<string, { masterId: string; name: string }>,
): DigestGroup[] {
  const closerCounts = new Map<string, DigestGroup>();
  const masterCounts = new Map<string, DigestGroup>();

  for (const lead of leads) {
    if (lead.closerId) {
      const key = `${lead.teamId}:${lead.closerId}:closer`;
      const existing = closerCounts.get(key);
      if (existing) {
        existing.leadCount += 1;
      } else {
        closerCounts.set(key, {
          teamId: lead.teamId,
          recipientProfileId: lead.closerId,
          role: "closer",
          leadCount: 1,
        });
      }
    }

    const team = teamMasterById.get(lead.teamId);
    if (team?.masterId) {
      const key = `${lead.teamId}:${team.masterId}:master`;
      const existing = masterCounts.get(key);
      if (existing) {
        existing.leadCount += 1;
      } else {
        masterCounts.set(key, {
          teamId: lead.teamId,
          recipientProfileId: team.masterId,
          role: "master",
          leadCount: 1,
        });
      }
    }
  }

  return [...closerCounts.values(), ...masterCounts.values()].filter((group) => group.leadCount > 0);
}

export class MeetingFollowUpUseCase {
  async processDigests(): Promise<Output> {
    try {
      const now = new Date();
      const cutoff = new Date(now.getTime() - MEETING_FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000);
      const digestDate = meetingFollowUpRepository.getDigestDateKey(now);

      const leads = await meetingFollowUpRepository.findLeadsRequiringFollowUp(cutoff);
      if (leads.length === 0) {
        return new Output(true, [], [], { processedRecipients: 0, emailsSent: 0, skippedByThrottle: 0 });
      }

      const teamIds = Array.from(new Set(leads.map((lead) => lead.teamId)));
      const teams = await meetingFollowUpRepository.findTeamsMasterIds(teamIds);
      const teamMasterById = new Map(
        teams.map((team) => [team.id, { masterId: team.masterId, name: team.name }] as const),
      );

      const groups = buildDigestGroups(leads, teamMasterById);
      const recipientIds = Array.from(new Set(groups.map((group) => group.recipientProfileId)));
      const profiles = await meetingFollowUpRepository.findRecipientProfiles(recipientIds);
      const profileById = new Map(profiles.map((profile) => [profile.id, profile] as const));

      let processedRecipients = 0;
      let emailsSent = 0;
      let skippedByThrottle = 0;

      for (const group of groups) {
        const canSend = await meetingFollowUpRepository.canSendDigestEmail(
          group.recipientProfileId,
          group.teamId,
          now,
        );

        if (!canSend) {
          skippedByThrottle += 1;
          continue;
        }

        const teamName = teamMasterById.get(group.teamId)?.name ?? "Time";
        const profile = profileById.get(group.recipientProfileId);
        const recipientName = profile?.fullName?.trim() || profile?.email || "Usuário";
        const crmUrl = profile?.supabaseId
          ? getFullUrl(`/${profile.supabaseId}/board`)
          : getFullUrl("/");

        await notificationService.createMeetingFollowUpDigestNotification({
          teamId: group.teamId,
          recipientProfileId: group.recipientProfileId,
          leadCount: group.leadCount,
          role: group.role,
        });

        await meetingFollowUpRepository.createDigestLog({
          recipientProfileId: group.recipientProfileId,
          teamId: group.teamId,
          digestDate,
          leadCount: group.leadCount,
          sentAt: now,
          channel: "in_app",
        });

        if (profile?.email) {
          await emailService.sendMeetingFollowUpDigestEmail({
            profileId: group.recipientProfileId,
            teamId: group.teamId,
            to: profile.email,
            recipientName,
            leadCount: group.leadCount,
            role: group.role,
            teamName,
            crmUrl,
          });

          await meetingFollowUpRepository.createDigestLog({
            recipientProfileId: group.recipientProfileId,
            teamId: group.teamId,
            digestDate,
            leadCount: group.leadCount,
            sentAt: now,
            channel: "email",
          });

          emailsSent += 1;
        }

        processedRecipients += 1;
      }

      return new Output(true, [], [], { processedRecipients, emailsSent, skippedByThrottle });
    } catch (error) {
      console.error("[MeetingFollowUpUseCase][processDigests] Erro:", error);
      return new Output(false, [], ["Erro ao processar digest de reuniões pendentes"], null);
    }
  }
}

export const meetingFollowUpUseCase = new MeetingFollowUpUseCase();
