import { getFullUrl } from "@/lib/utils/app-url";

export type NotificationLinkMetadata = {
  leadCode?: string | null;
  leadId?: string;
  leadName?: string;
  activityId?: string;
  meetingDate?: string;
  meetingLink?: string | null;
  scheduleShareUrl?: string | null;
  event?: string;
  errorMessage?: string;
  leadCount?: number;
  role?: "closer" | "master";
  filter?: string;
  campaignId?: string;
};

export type NotificationLinkInput = {
  supabaseId: string;
  type: string;
  metadata?: NotificationLinkMetadata | null;
};

const LEAD_LINK_TYPES = new Set([
  "ACTIVITY_MENTION",
  "ACTIVITY_REACTION",
  "LEAD_SCHEDULE_CREATED",
  "LEAD_PROPOSAL_PENDING",
  "LEAD_TRANSFER_ACTIVATED",
  "LEAD_TRANSFER_SCHEDULE_FAILED",
  "MEETING_REMINDER",
]);

export function hasLeadNotificationLink(type: string, metadata?: NotificationLinkMetadata | null) {
  if (!LEAD_LINK_TYPES.has(type)) return false;
  return typeof metadata?.leadCode === "string" && metadata.leadCode.trim().length > 0;
}

export function getMeetingLink(metadata?: NotificationLinkMetadata | null) {
  if (!metadata || typeof metadata !== "object") return null;
  const meetingLink =
    typeof metadata.meetingLink === "string" && metadata.meetingLink.trim()
      ? metadata.meetingLink
      : null;
  const scheduleShareUrl =
    typeof metadata.scheduleShareUrl === "string" && metadata.scheduleShareUrl.trim()
      ? metadata.scheduleShareUrl
      : null;
  return meetingLink ?? scheduleShareUrl;
}

export function buildNotificationPath(input: NotificationLinkInput): string {
  const metadata = input.metadata ?? null;

  if (input.type === "MEETING_FOLLOW_UP_DIGEST") {
    return `/${input.supabaseId}/board`;
  }

  if (input.type === "EMAIL_CAMPAIGN_DISPATCH_FAILED") {
    return `/${input.supabaseId}/email/campanhas`;
  }

  if (hasLeadNotificationLink(input.type, metadata) && metadata?.leadCode) {
    const params = new URLSearchParams();
    params.set("leadCode", metadata.leadCode);
    if (typeof metadata.activityId === "string" && metadata.activityId.trim()) {
      params.set("activityId", metadata.activityId);
    }
    return `/${input.supabaseId}/crm?${params.toString()}`;
  }

  return `/${input.supabaseId}/notifications`;
}

export function buildNotificationUrl(input: NotificationLinkInput): string {
  const path = buildNotificationPath(input);
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return getFullUrl(path);
}
