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
  resolveMemberProBypass,
} from "@/app/api/services/billing/memberProBillingRules";
import { createEmailService } from "@/lib/services/EmailService";
import { getFullUrl } from "@/lib/utils/app-url";

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
    const assignment = await this.repository.findUserTypeAssignment(masterId);
    if (!assignment) {
      return { slug: "common", isActive: false, accessExpiresAt: null };
    }
    return buildMemberProContextFromAssignment(assignment);
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

      if (!context.isActive && context.slug !== "member_pro") {
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

    if (context.slug === "member_pro") {
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
      const emailService = createEmailService();
      const DAY_MS = 24 * 60 * 60 * 1000;

      for (const assignment of assignments) {
        await this.syncUsageToSubscription(assignment.profileId, "member_pro_expiration");

        const shouldNotify =
          assignment.accessExpiresAt !== null &&
          assignment.accessExpiresAt.getTime() >= now.getTime() - DAY_MS;

        if (shouldNotify && assignment.email) {
          const summary = await getBillingSummary(assignment.profileId);
          const masterName = assignment.fullName || assignment.email;
          const formattedTotal = new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(summary.totalPrice);

          await emailService
            .sendEmail({
              to: [assignment.email],
              subject: "Member PRO encerrado — assinatura atualizada",
              html: `
                <p>Olá, ${masterName}.</p>
                <p>Seu período Member PRO foi encerrado. Sua assinatura foi atualizada para refletir o uso atual da conta.</p>
                <p><strong>Novo valor recorrente:</strong> ${formattedTotal}</p>
                <p><a href="${getFullUrl("/subscription")}">Gerenciar assinatura</a></p>
              `,
            })
            .catch((error: unknown) => {
              console.error(
                `[MemberProBillingUseCase] Falha ao enviar e-mail para ${assignment.profileId}:`,
                error
              );
            });
        }
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
