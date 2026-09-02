import { asaasSubscriptionSyncRepository } from "@/app/api/infra/data/repositories/billing/AsaasSubscriptionSyncRepository";
import { createAsaasClient } from "@/lib/asaas";
import type { SubscriptionStatus } from "@prisma/client";

type AsaasSubscriptionResponse = {
  id?: string;
  value?: number;
  nextDueDate?: string;
  cycle?: string;
  status?: string;
  dateCreated?: string;
  endDate?: string;
  billingType?: string;
  description?: string;
};

function normalizeSubscriptionStatus(status: string | undefined): SubscriptionStatus | undefined {
  switch (status) {
    case "ACTIVE":
    case "active":
      return "active";
    case "OVERDUE":
    case "past_due":
      return "past_due";
    case "INACTIVE":
    case "CANCELED":
    case "canceled":
      return "canceled";
    default:
      return undefined;
  }
}

export class AsaasSubscriptionSyncService {
  async syncFromAsaas(profileId: string): Promise<Date | null> {
    const syncSnapshot = await asaasSubscriptionSyncRepository.getSyncSnapshot(profileId);
    if (!syncSnapshot || syncSnapshot.hasPermanentSubscription) {
      return null;
    }

    if (!syncSnapshot.asaasSubscriptionId) {
      return null;
    }

    // DA2 (20 — Assinaturas — Backend E4): roteia pela conta do ponteiro —
    // sub_ legado bate 404 na primary durante a janela dual.
    const client = createAsaasClient(syncSnapshot.asaasSubscriptionAccount);
    const subscription = (await client.request(`${client.endpoints.subscriptions}/${syncSnapshot.asaasSubscriptionId}`, {
      method: "GET",
    })) as AsaasSubscriptionResponse;

    const syncedAt = new Date();
    const nextDueDate = subscription.nextDueDate ? new Date(subscription.nextDueDate) : undefined;
    const startDate = subscription.dateCreated ? new Date(subscription.dateCreated) : undefined;
    const endDate = subscription.endDate ? new Date(subscription.endDate) : undefined;
    const data = {
      subscriptionStatus: normalizeSubscriptionStatus(subscription.status),
      subscriptionCycle: subscription.cycle ?? undefined,
      subscriptionNextDueDate: nextDueDate,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
      subscriptionLastSyncedAt: syncedAt,
    };

    await asaasSubscriptionSyncRepository.saveSyncData(profileId, syncSnapshot.asaasSubscriptionId, data);

    return syncedAt;
  }
}

export const asaasSubscriptionSyncService = new AsaasSubscriptionSyncService();
