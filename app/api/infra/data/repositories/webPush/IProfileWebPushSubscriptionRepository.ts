export type UpsertWebPushSubscriptionInput = {
  profileId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
};

export type DeactivateWebPushSubscriptionInput = {
  profileId: string;
  endpoint: string;
};

export interface IProfileWebPushSubscriptionRepository {
  upsertSubscription(input: UpsertWebPushSubscriptionInput): Promise<void>;
  deactivateSubscription(input: DeactivateWebPushSubscriptionInput): Promise<void>;
  findActiveByProfileId(profileId: string): Promise<
    Array<{
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }>
  >;
  deactivateByEndpoint(endpoint: string): Promise<void>;
  findSupabaseIdByProfileId(profileId: string): Promise<string | null>;
}
