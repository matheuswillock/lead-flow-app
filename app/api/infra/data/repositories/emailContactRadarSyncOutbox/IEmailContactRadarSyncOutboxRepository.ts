export type EmailContactRadarSyncOutboxClaimRow = {
  id: string;
  emailContactId: string;
  teamId: string;
  emailImportJobId: string | null;
  attemptCount: number;
};

export type UpsertRadarSyncOutboxEntry = {
  emailContactId: string;
  teamId: string;
  emailImportJobId: string;
};

export interface IEmailContactRadarSyncOutboxRepository {
  upsertPendingForContacts(entries: UpsertRadarSyncOutboxEntry[]): Promise<void>;
  claimDue(limit: number): Promise<EmailContactRadarSyncOutboxClaimRow[]>;
  requeueIfProcessing(ids: string[]): Promise<void>;
  markSent(id: string): Promise<void>;
  markFailedWithRetry(
    id: string,
    attemptCount: number,
    nextAttemptAt: Date | null,
    lastError: string
  ): Promise<void>;
  countPendingByImportJobId(emailImportJobId: string): Promise<number>;
}
