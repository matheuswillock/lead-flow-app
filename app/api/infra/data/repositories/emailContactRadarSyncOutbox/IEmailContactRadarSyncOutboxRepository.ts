export type EmailContactRadarSyncOutboxClaimRow = {
  id: string;
  emailContactId: string;
  teamId: string;
  emailImportJobId: string | null;
  attemptCount: number;
  generation: number;
};

export type UpsertRadarSyncOutboxEntry = {
  emailContactId: string;
  teamId: string;
  emailImportJobId?: string | null;
};

export type EmailContactRadarSyncOutboxBacklogSnapshot = {
  pending: number;
  processing: number;
  maxPendingAgeSeconds: number | null;
};

export interface IEmailContactRadarSyncOutboxRepository {
  upsertPendingForContacts(entries: UpsertRadarSyncOutboxEntry[]): Promise<void>;
  enqueueMissingForList(teamId: string, listId: string): Promise<number>;
  claimDue(limit: number): Promise<EmailContactRadarSyncOutboxClaimRow[]>;
  requeueIfProcessing(ids: string[]): Promise<void>;
  markSent(id: string, generation: number): Promise<boolean>;
  markFailedWithRetry(
    id: string,
    generation: number,
    attemptCount: number,
    nextAttemptAt: Date | null,
    lastError: string
  ): Promise<boolean>;
  countPendingByImportJobId(emailImportJobId: string): Promise<number>;
  getBacklogSnapshot(): Promise<EmailContactRadarSyncOutboxBacklogSnapshot>;
}
