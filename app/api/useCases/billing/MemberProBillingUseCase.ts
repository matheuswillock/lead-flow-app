import { Output } from "@/lib/output";
import {
  memberProBillingRepository,
  type IMemberProBillingRepository,
} from "@/app/api/infra/data/repositories/billing/MemberProBillingRepository";
import { getBillingSummary } from "@/app/api/services/billing/TeamBillingService";
import { incrementalBillingService } from "@/app/api/services/billing/IncrementalBillingService";
import type {
  IMemberProBillingService,
  MemberProBillingContext,
  MemberProBypassOptions,
} from "@/app/api/services/billing/IMemberProBillingService";
import {
  buildMemberProContextFromAssignment,
  resolveHasUnlimitedUsers,
  resolveMemberProBypass,
} from "@/app/api/shared/billing/memberProBillingRules";

const syncLocks = new Map<string, Promise<void>>();

function withMasterSyncLock(masterId: string, task: () => Promise<void>): Promise<void> {
  const previous = syncLocks.get(masterId) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(task)
    .finally(() => {
      if (syncLocks.get(masterId) === next) {
        syncLocks.delete(masterId);
      }
    });
  syncLocks.set(masterId, next);
  return next;
}

export class MemberProBillingUseCase implements IMemberProBillingService {
  constructor(private readonly repository: IMemberProBillingRepository = memberProBillingRepository) {}

  async getMemberProContext(masterId: string): Promise<MemberProBillingContext> {
    const [assignment, owner] = await Promise.all([
      this.repository.findUserTypeAssignment(masterId),
      this.repository.findBillingOwner(masterId),
    ]);
    const base = assignment
      ? buildMemberProContextFromAssignment(assignment)
      : { slug: "common", isActive: false, accessExpiresAt: null };
    return {
      ...base,
      hasUnlimitedUsers: resolveHasUnlimitedUsers({
        hasUnlimitedUsersFlag: owner?.hasUnlimitedUsers,
        billingCycle: owner?.subscriptionCycle,
        memberProSlug: assignment?.slug,
        memberProActive: base.isActive,
      }),
    };
  }

  async isMemberProDeferredBillingActive(masterId: string): Promise<boolean> {
    const context = await this.getMemberProContext(masterId);
    return context.isActive;
  }

  async shouldBypassIncrementalCharge(
    masterId: string,
    options?: MemberProBypassOptions
  ): Promise<boolean> {
    const context = await this.getMemberProContext(masterId);
    return resolveMemberProBypass(context, options);
  }

  async syncUsageToSubscription(masterId: string, reason: string): Promise<void> {
    await withMasterSyncLock(masterId, async () => {
      const [context, owner] = await Promise.all([
        this.getMemberProContext(masterId),
        this.repository.findBillingOwner(masterId),
      ]);

      if (!owner || owner.hasPermanentSubscription) {
        return;
      }

      if (
        !context.isActive &&
        context.slug !== "member_pro" &&
        reason !== "has_unlimited_users_toggle" &&
        reason !== "member_pro_expiration"
      ) {
        return;
      }

      const summary = await getBillingSummary(masterId);
      const nextDueDateOverride =
        context.isActive && context.accessExpiresAt ? context.accessExpiresAt : null;

      try {
        await incrementalBillingService.ensureOrSyncRecurringSubscription({
          master: owner,
          targetRecurringTotal: summary.totalPrice,
          reason,
          nextDueDateOverride,
          defaultBillingType: "PIX",
        });
      } catch (error) {
        console.error(`[MemberProBillingUseCase][syncUsageToSubscription][${masterId}]`, error);
      }
    });
  }

  async syncBillingAfterUsageChange(masterId: string, reason: string): Promise<void> {
    const context = await this.getMemberProContext(masterId);

    if (context.slug === "member_pro" || reason === "has_unlimited_users_toggle") {
      await this.syncUsageToSubscription(masterId, reason);
      return;
    }

    const owner = await this.repository.findBillingOwner(masterId);
    if (!owner || owner.hasPermanentSubscription || !owner.asaasSubscriptionId) {
      return;
    }

    await withMasterSyncLock(masterId, async () => {
      try {
        const summary = await getBillingSummary(masterId);
        await incrementalBillingService.syncRecurringSubscription({
          master: owner,
          targetRecurringTotal: summary.totalPrice,
          reason,
        });
      } catch (error) {
        console.error(`[MemberProBillingUseCase][syncBillingAfterUsageChange][${masterId}]`, error);
      }
    });
  }

  async processExpiredMemberProAccounts(): Promise<Output> {
    try {
      const now = new Date();
      const assignments = await this.repository.findExpiredMemberProAssignments(now);

      for (const assignment of assignments) {
        await this.repository.expireMemberProAssignment(assignment.profileId, now);
      }

      return new Output(
        true,
        [`${assignments.length} conta(s) Member PRO processada(s)`],
        [],
        { processed: assignments.length }
      );
    } catch (error) {
      console.error("[MemberProBillingUseCase][processExpiredMemberProAccounts]", error);
      return new Output(false, [], ["Erro ao processar expirações Member PRO"], null);
    }
  }
}

export const memberProBillingUseCase = new MemberProBillingUseCase();
