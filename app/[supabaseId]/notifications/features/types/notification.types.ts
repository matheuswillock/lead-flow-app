export type NotificationTypeValue =
  | "ACTIVITY_MENTION"
  | "ACTIVITY_REACTION"
  | "TEAM_MEMBER_ADDED"
  | "TEAM_MEMBER_REMOVED"
  | "LEAD_SCHEDULE_CREATED";

export type NotificationMetadata = {
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
