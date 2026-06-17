export type NotificationTypeValue =
  | "ACTIVITY_MENTION"
  | "ACTIVITY_REACTION"
  | "TEAM_MEMBER_ADDED"
  | "TEAM_MEMBER_REMOVED"
  | "LEAD_SCHEDULE_CREATED"
  | "LEAD_PROPOSAL_PENDING"
  | "LEAD_TRANSFER_ACTIVATED";

export type NotificationMetadata = {
  event?: "GOOGLE_CONNECTED" | "GOOGLE_DISCONNECTED" | "TASK_ASSIGNED" | "TASK_COMPLETED" | string;
  googleEmail?: string | null;
  previousGoogleEmail?: string | null;
  leadId?: string;
  leadCode?: string | null;
  leadName?: string;
  activityId?: string;
  emoji?: string;
  preview?: string;
  meetingDate?: string;
  isReschedule?: boolean;
  teamId?: string;
  teamName?: string;
  leadEmail?: string | null;
  leadPhone?: string | null;
  sdrName?: string | null;
  closerName?: string | null;
  notes?: string | null;
  previousStatus?: string;
  nextStatus?: string;
  scheduleShareUrl?: string | null;
};

export type MarkAllAsReadOptions = {
  keepalive?: boolean;
};

export type NotificationActor = {
  id: string;
  fullName: string | null;
  email: string;
  profileIconUrl: string | null;
};

export type NotificationItem = {
  id: string;
  recipientProfileId: string;
  actorProfileId: string | null;
  teamId: string;
  type: NotificationTypeValue;
  message: string;
  metadata: NotificationMetadata | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  actor?: NotificationActor | null;
};

export type NotificationsListResponse = {
  notifications: NotificationItem[];
  total: number;
  limit: number;
  offset: number;
};

export type NotificationsContextState = {
  notifications: NotificationItem[];
  unreadCount: number;
  total: number;
  isLoadingList: boolean;
  isLoadingUnread: boolean;
  error: string | null;
  loadNotifications: (params?: { limit?: number; offset?: number }) => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  markAllAsRead: (options?: MarkAllAsReadOptions) => Promise<void>;
};
