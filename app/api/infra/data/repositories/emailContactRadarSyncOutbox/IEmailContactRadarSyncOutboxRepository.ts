export type EmailContactRadarSyncOutboxClaimRow = {
  id: string;
  emailContactId: string;
  teamId: string;
  emailImportJobId: string | null;
  attemptCount: number;
  syncGeneration: number;
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
  markSent(id: string, syncGeneration: number): Promise<boolean>;
  markFailedWithRetry(
    id: string,
    syncGeneration: number,
    attemptCount: number,
    nextAttemptAt: Date | null,
    lastError: string
  ): Promise<boolean>;
  countPendingByImportJobId(emailImportJobId: string): Promise<number>;
}
