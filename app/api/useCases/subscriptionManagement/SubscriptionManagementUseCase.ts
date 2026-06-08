import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { getBillingSummary } from "@/app/api/services/billing/TeamBillingService";
import { asaasSubscriptionSyncService } from "@/app/api/services/billing/AsaasSubscriptionSyncService";
import { subscriptionCreditService } from "@/app/api/services/billing/SubscriptionCreditService";
import { incrementalBillingService } from "@/app/api/services/billing/IncrementalBillingService";
import { billingRepository } from "@/app/api/infra/data/repositories/billing/BillingRepository";
import { getFullUrl } from "@/lib/utils/app-url";
import { asaasApi, asaasFetch } from "@/lib/asaas";
import type { BillingOwnerProfile } from "@/app/api/services/billing/IIncrementalBillingService";
import type { 
  ISubscriptionManagementUseCase, 
  UpdatePaymentMethodDTO 
} from "./ISubscriptionManagementUseCase";

type CreditUpdateInput = {
  action?: unknown;
  resource?: unknown;
  quantity?: unknown;
  billingType?: unknown;
};

interface AsaasPaymentItem {
  id: string;
  customer?: string;
  status?: string;
  value?: number;
  dueDate?: string;
  dateCreated?: string;
  clientPaymentDate?: string;
  paymentDate?: string;
  description?: string;
  billingType?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  invoiceNumber?: string;
}

type ProfileSubscriptionSnapshot = {
  asaasSubscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  trialEndDate: Date | null;
  subscriptionNextDueDate: Date | null;
  subscriptionCycle: string | null;
  hasPermanentSubscription: boolean;
  subscriptionLastSyncedAt?: Date | null;
};

const SYNC_STALE_MS = 60 * 60 * 1000;

function getCycleLabel(cycle: string | null | undefined): string {
  switch (cycle) {
    case "WEEKLY":
      return "Semanal";
    case "BIWEEKLY":
      return "Quinzenal";
    case "QUARTERLY":
      return "Trimestral";
    case "SEMIANNUALLY":
      return "Semestral";
    case "YEARLY":
      return "Anual";
    case "MONTHLY":
    default:
      return "Mensal";
  }
}

function shouldSync(lastSyncedAt: Date | null | undefined): boolean {
  if (!lastSyncedAt) return true;
  return Date.now() - lastSyncedAt.getTime() > SYNC_STALE_MS;
}

const roundCurrency = (value: number) => Number(value.toFixed(2));

export class SubscriptionManagementUseCase implements ISubscriptionManagementUseCase {
  private async getBillingOwnerBySupabaseId(supabaseId: string, options?: { masterOnly?: boolean }): Promise<BillingOwnerProfile | null> {
    const requester = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true, isMaster: true, managerId: true },
    });

    if (!requester) return null;
    if (options?.masterOnly && !requester.isMaster) return null;

    const ownerId = requester.isMaster ? requester.id : requester.managerId;
    if (!ownerId) return null;

    const owner = await prisma.profile.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        fullName: true,
        email: true,
        cpfCnpj: true,
        phone: true,
        postalCode: true,
        address: true,
        addressNumber: true,
        neighborhood: true,
        complement: true,
        subscription: {
          select: {
            asaasCustomerId: true,
            asaasSubscriptionId: true,
            subscriptionStatus: true,
            subscriptionNextDueDate: true,
            subscriptionCycle: true,
            hasPermanentSubscription: true,
            subscriptionPlan: true,
            subscriptionStartDate: true,
            subscriptionEndDate: true,
          },
        },
        timezone: true,
        isMaster: true,
      },
    });

    if (!owner) {
      return null;
    }

    return {
      id: owner.id,
      fullName: owner.fullName,
      email: owner.email,
      cpfCnpj: owner.cpfCnpj,
      phone: owner.phone,
      postalCode: owner.postalCode,
      address: owner.address,
      addressNumber: owner.addressNumber,
      neighborhood: owner.neighborhood,
      complement: owner.complement,
      asaasCustomerId: owner.subscription?.asaasCustomerId ?? null,
      asaasSubscriptionId: owner.subscription?.asaasSubscriptionId ?? null,
      subscriptionStatus: owner.subscription?.subscriptionStatus ?? null,
      subscriptionNextDueDate: owner.subscription?.subscriptionNextDueDate ?? null,
      subscriptionCycle: owner.subscription?.subscriptionCycle ?? null,
      hasPermanentSubscription: owner.subscription?.hasPermanentSubscription ?? false,
      timezone: owner.timezone,
    };
  }

  private async getProfileSubscription(profileId: string): Promise<ProfileSubscriptionSnapshot | null> {
    try {
      return await prisma.profileSubscription.findUnique({
        where: { profileId },
        select: {
          asaasSubscriptionId: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          subscriptionStartDate: true,
          subscriptionEndDate: true,
          trialEndDate: true,
          subscriptionNextDueDate: true,
          subscriptionCycle: true,
          hasPermanentSubscription: true,
          subscriptionLastSyncedAt: true,
        },
      });
    } catch (error) {
      console.info("[SubscriptionManagementUseCase] Campo de sync indisponível, usando assinatura sem lastSyncedAt.", error);
      return prisma.profileSubscription.findUnique({
        where: { profileId },
        select: {
          asaasSubscriptionId: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          subscriptionStartDate: true,
          subscriptionEndDate: true,
          trialEndDate: true,
          subscriptionNextDueDate: true,
          subscriptionCycle: true,
          hasPermanentSubscription: true,
        },
      });
    }
  }

  private async fetchAllCustomerPayments(customerId: string): Promise<AsaasPaymentItem[]> {
    const limit = 100;
    let offset = 0;
    let totalCount: number | null = null;
    const items: AsaasPaymentItem[] = [];

    for (let iteration = 0; iteration < 30; iteration += 1) {
      const params = new URLSearchParams({
        customer: customerId,
        offset: String(offset),
        limit: String(limit),
      });

      const response = await asaasFetch(`${asaasApi.payments}?${params.toString()}`, {
        method: "GET",
      });

      const chunk = Array.isArray(response?.data)
        ? (response.data as AsaasPaymentItem[])
        : [];

      if (totalCount === null && Number.isFinite(Number(response?.totalCount))) {
        totalCount = Number(response.totalCount);
      }

      if (chunk.length === 0) {
        break;
      }

      items.push(...chunk);
      offset += chunk.length;

      if (chunk.length < limit) {
        break;
      }

      if (totalCount !== null && offset >= totalCount) {
        break;
      }
    }

    return items;
  }

  private getInvoiceSortTimestamp(invoice: AsaasPaymentItem): number {
    const reference = invoice.dueDate ?? invoice.dateCreated;
    if (!reference) return 0;

    const parsed = new Date(reference);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  private normalizeMoney(value: unknown): number {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  async syncSubscription(supabaseId: string): Promise<Output> {
    try {
      if (!supabaseId) {
        return new Output(false, [], ["Não autenticado"], null);
      }

      const billingOwner = await this.getBillingOwnerBySupabaseId(supabaseId);
      if (!billingOwner) {
        return new Output(false, [], ["Conta responsável pela assinatura não encontrada"], null);
      }

      const syncedAt = await asaasSubscriptionSyncService.syncFromAsaas(billingOwner.id);

      return new Output(true, ["Assinatura sincronizada com sucesso"], [], {
        syncedAt: syncedAt?.toISOString() ?? null,
      });
    } catch (error) {
      console.error("[SubscriptionManagementUseCase][syncSubscription]", error);
      return new Output(false, [], ["Erro ao sincronizar assinatura"], null);
    }
  }

  async updateCredits(supabaseId: string, input: CreditUpdateInput): Promise<Output> {
    try {
      const action = input.action === "remove" ? "remove" : input.action === "add" ? "add" : null;
      const resource = input.resource === "team" ? "team" : input.resource === "user" ? "user" : null;
      const quantity = typeof input.quantity === "number" ? input.quantity : Number(input.quantity);

      if (!action || !resource || !Number.isInteger(quantity) || quantity < 1) {
        return new Output(false, [], ["Dados de créditos inválidos"], null);
      }

      const owner = await this.getBillingOwnerBySupabaseId(supabaseId, { masterOnly: true });
      if (!owner) {
        return new Output(false, [], ["Apenas o master pode atualizar créditos"], null);
      }

      if (owner.hasPermanentSubscription) {
        return new Output(false, [], ["Assinaturas vitalícias não precisam de gestão de créditos"], null);
      }

      const currentSummary = await getBillingSummary(owner.id);
      if (resource === "user" && currentSummary.hasUnlimitedUsers) {
        return new Output(
          false,
          [],
          ["Plano anual já possui usuários ilimitados. A gestão de créditos de usuários está desabilitada."],
          null
        );
      }

      const teams = resource === "team" ? quantity : 0;
      const users = resource === "user" ? quantity : 0;

      if (action === "remove") {
        const removal = await subscriptionCreditService.removeCredits(owner.id, { teams, users });

        await incrementalBillingService.syncRecurringSubscription({
          master: owner,
          targetRecurringTotal: removal.targetRecurringTotal,
          reason: "Remoção de créditos de assinatura",
        });

        return new Output(true, ["Créditos removidos com sucesso"], [], removal.summary);
      }

      const projection = await subscriptionCreditService.projectCreditAddition(owner.id, { teams, users });
      if (projection.billingDelta <= 0) {
        return new Output(false, [], ["Não há cobrança incremental para estes créditos"], null);
      }

      const endDate = await billingRepository.getSubscriptionEndDate(owner.id);
      const now = new Date();
      const remainingMonths = endDate
        ? Math.max(1, Math.round((endDate.getFullYear() - now.getFullYear()) * 12 + (endDate.getMonth() - now.getMonth())))
        : 1;
      const totalCharge = roundCurrency(projection.billingDelta * remainingMonths);
      const addonLabel = resource === "team" ? "Créditos de times" : "Créditos de usuários";
      const addonDetail = `${quantity} ${quantity === 1 ? "crédito" : "créditos"} de ${
        resource === "team" ? "time" : "usuário"
      }`;

      const pendingAction = await prisma.pendingAction.create({
        data: {
          masterId: owner.id,
          actionType: "update_subscription_credits",
          status: "pending",
          payload: {
            addonType: resource,
            addonLabel,
            addonDetail,
            addedTeamCredits: teams,
            addedUserCredits: users,
            billingType: input.billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX",
            billingDelta: projection.billingDelta,
            targetRecurringTotal: projection.targetRecurringTotal,
            totalCharge,
            remainingMonths,
            maxInstallments: remainingMonths,
          },
        },
        select: { id: true },
      });

      return new Output(true, ["Checkout de créditos criado"], [], {
        pendingActionId: pendingAction.id,
        checkoutUrl: getFullUrl(`/addon-checkout/${pendingAction.id}`),
        amount: totalCharge,
      });
    } catch (error) {
      console.error("[SubscriptionManagementUseCase][updateCredits]", error);
      return new Output(false, [], ["Erro ao atualizar créditos"], null);
    }
  }

  
  async getSubscription(supabaseId: string): Promise<Output> {
    try {
      // Validação
      if (!supabaseId) {
        return new Output(
          false,
          [],
          ['ID do usuário é obrigatório'],
          null
        );
      }

      const requesterProfile = await prisma.profile.findUnique({
        where: { supabaseId },
        include: {
          subscription: true,
        },
      });

      if (!requesterProfile) {
        return new Output(
          false,
          [],
          ['Usuário não encontrado'],
          null
        );
      }

      const masterIdForBilling = requesterProfile.isMaster ? requesterProfile.id : requesterProfile.managerId;
      if (!masterIdForBilling) {
        return new Output(true, ['Nenhuma assinatura ativa encontrada'], [], null);
      }

      const profile =
        masterIdForBilling === requesterProfile.id
          ? requesterProfile
          : await prisma.profile.findUnique({
              where: { id: masterIdForBilling },
              include: {
                subscription: true,
              },
            });

      if (!profile) {
        return new Output(false, [], ['Master responsável pela assinatura não encontrado'], null);
      }

      const profileSubscription = await this.getProfileSubscription(masterIdForBilling);
      const hasPermanentSubscription =
        profileSubscription?.hasPermanentSubscription === true || profile.subscription?.hasPermanentSubscription === true;
      const asaasSubscriptionId = profileSubscription?.asaasSubscriptionId ?? profile.subscription?.asaasSubscriptionId;

      // Verificar se tem asaasSubscriptionId (campo mais confiável)
      if (!asaasSubscriptionId && !hasPermanentSubscription) {
        return new Output(
          true,
          ['Nenhuma assinatura ativa encontrada'],
          [],
          null
        );
      }

      // Calcular valor com base na nova regra (Times + usuários distinct) sempre que possível.
      // Se não for possível (ex.: masterId ausente), fazemos fallback para regra antiga.
      const basePrice = 59.9;
      const extraTeamPrice = 29.9;
      const extraUserPrice = 19.9;

      let billingSummary: any | null = null;
      try {
        billingSummary = await getBillingSummary(masterIdForBilling);
      } catch (err) {
        console.warn("[SubscriptionManagementUseCase] Falha ao calcular billing summary:", err);
        billingSummary = null;
      }

      // Fallback legacy: contar usuários linkados via managerId (modelo antigo).
      // Quando um usuário não-master consulta esta tela, precisamos computar na ótica do master pagante,
      // não do próprio usuário.
      const legacyMasterId = masterIdForBilling ?? profile.id;

      const actualOperatorCount = await prisma.profile.count({
        where: {
          managerId: legacyMasterId,
          role: { in: ["operator", "manager"] },
        },
      });

      const legacyTeamCount = await prisma.team.count({
        where: { masterId: legacyMasterId },
      });

      const legacyBillableTeams = Math.max(0, legacyTeamCount - 1);
      const legacyTotal =
        basePrice +
        legacyBillableTeams * extraTeamPrice +
        actualOperatorCount * extraUserPrice;
      const subscriptionPlan = profileSubscription?.subscriptionPlan ?? profile.subscription?.subscriptionPlan;
      const subscriptionStatus = profileSubscription?.subscriptionStatus ?? profile.subscription?.subscriptionStatus;
      const subscriptionCycle = profileSubscription?.subscriptionCycle ?? profile.subscription?.subscriptionCycle ?? "MONTHLY";
      const subscriptionNextDueDate =
        profileSubscription?.subscriptionNextDueDate ??
        profile.subscription?.subscriptionNextDueDate ??
        profileSubscription?.subscriptionEndDate ??
        profile.subscription?.subscriptionEndDate;
      const subscriptionStartedAt =
        profileSubscription?.subscriptionStartDate ?? profile.subscription?.subscriptionStartDate ?? profile.createdAt;
      const lastSyncedAt = profileSubscription?.subscriptionLastSyncedAt ?? null;
      const totalValue =
        hasPermanentSubscription
          ? 0
          : subscriptionPlan === "free_trial"
            ? 0
            : billingSummary?.totalPrice ?? Number(legacyTotal.toFixed(2));

      if (!hasPermanentSubscription && shouldSync(lastSyncedAt)) {
        void asaasSubscriptionSyncService.syncFromAsaas(masterIdForBilling).catch((syncError) => {
          console.error("[SubscriptionManagementUseCase] Falha no sync assíncrono da assinatura:", syncError);
        });
      }

      // Formatar dados da assinatura
      const subscriptionData = {
        id: asaasSubscriptionId || 'permanent-subscription',
        subscriptionAsaasId: asaasSubscriptionId || 'permanent-subscription',
        status: hasPermanentSubscription ? 'active' : (subscriptionStatus || 'active'),
        value: totalValue,
        nextDueDate: subscriptionNextDueDate?.toISOString() || '',
        cycle: subscriptionCycle,
        cycleLabel: getCycleLabel(subscriptionCycle),
        subscriptionStartedAt: subscriptionStartedAt?.toISOString(),
        lastSyncedAt: lastSyncedAt?.toISOString(),
        description: hasPermanentSubscription ? 'Assinatura Vitalícia (Sem Custo)' :
                     subscriptionPlan === 'free_trial' ? 'Período de teste' :
                     subscriptionPlan === 'manager_base' ? 'Plano Manager Base' :
                     `Plano Manager Base`,
        billingType: 'CREDIT_CARD',
        hasPermanentSubscription,
        customer: {
          name: profile.fullName || 'Usuário',
          email: profile.email
        },
        externalReference: profile.subscription?.asaasCustomerId || undefined,
        createdAt: subscriptionStartedAt?.toISOString() || profile.createdAt.toISOString(),
        billingSummary: billingSummary
          ? {
              ...billingSummary,
              // Garantir preços e arredondamento consistente no frontend
              basePrice,
              extraTeamsPrice: Number((billingSummary.billableTeams * extraTeamPrice).toFixed(2)),
              extraUsersPrice: Number((billingSummary.billableUsers * extraUserPrice).toFixed(2)),
              totalPrice: Number(Number(billingSummary.totalPrice).toFixed(2)),
            }
          : null,
        planDetails: {
          plan: subscriptionPlan,
          // Mantemos operatorCount por compatibilidade (UI antiga). Agora representa usuários cobrados (distinct, exceto master).
          operatorCount: billingSummary?.billableUsers ?? actualOperatorCount,
          teamCount: billingSummary?.teamCount,
          distinctUserCount: billingSummary?.distinctUserCount,
          trialEndDate: (profileSubscription?.trialEndDate ?? profile.subscription?.trialEndDate)?.toISOString()
        }
      };

      return new Output(
        true,
        ['Assinatura recuperada com sucesso'],
        [],
        subscriptionData
      );

    } catch (error) {
      console.error('Erro ao buscar assinatura:', error);
      return new Output(
        false,
        [],
        ['Erro interno ao buscar assinatura'],
        null
      );
    }
  }

  async getInvoices(supabaseId: string): Promise<Output> {
    try {
      // Validação
      if (!supabaseId) {
        return new Output(
          false,
          [],
          ['ID do usuário é obrigatório'],
          null
        );
      }

      // Buscar profile do usuário
      const profile = await prisma.profile.findUnique({
        where: { supabaseId },
        select: {
          id: true,
          supabaseId: true,
          fullName: true,
          email: true,
          isMaster: true,
          managerId: true,
          subscription: {
            select: {
              asaasCustomerId: true,
              asaasSubscriptionId: true,
            },
          },
        }
      });

      if (!profile) {
        return new Output(
          false,
          [],
          ['Usuário não encontrado'],
          null
        );
      }

      const billingOwnerId = profile.isMaster ? profile.id : profile.managerId;
      const billingOwner =
        billingOwnerId && billingOwnerId !== profile.id
          ? await prisma.profile.findUnique({
              where: { id: billingOwnerId },
              select: {
                id: true,
                fullName: true,
                email: true,
                subscription: {
                  select: {
                    asaasCustomerId: true,
                    asaasSubscriptionId: true,
                  },
                },
              },
            })
          : profile;

      if (!billingOwner) {
        return new Output(false, [], ['Master responsável pela assinatura não encontrado'], null);
      }

      const profileSubscription = await this.getProfileSubscription(billingOwner.id);
      let customerId = billingOwner.subscription?.asaasCustomerId ?? null;
      const asaasSubscriptionId = profileSubscription?.asaasSubscriptionId ?? billingOwner.subscription?.asaasSubscriptionId;

      // Fallback para cenários legados onde o customer não foi persistido no profile
      if (!customerId && asaasSubscriptionId) {
        try {
          const subscription = await asaasFetch(
            `${asaasApi.subscriptions}/${asaasSubscriptionId}`,
            { method: "GET" }
          ) as { customer?: string };

          if (subscription?.customer) {
            customerId = subscription.customer;
          }
        } catch (subscriptionError) {
          console.error('[SubscriptionManagementUseCase][getInvoices] Erro ao buscar assinatura no Asaas:', subscriptionError);
        }
      }

      if (!customerId) {
        return new Output(
          true,
          ['Nenhuma fatura encontrada'],
          [],
          []
        );
      }

      const allPayments = await this.fetchAllCustomerPayments(customerId);

      const invoices = allPayments
        .filter((item) => item.customer === customerId)
        .sort((a, b) => this.getInvoiceSortTimestamp(b) - this.getInvoiceSortTimestamp(a))
        .map((item) => ({
          id: item.id,
          status: item.status ?? 'PENDING',
          value: this.normalizeMoney(item.value),
          dueDate: item.dueDate ?? '',
          paymentDate: item.clientPaymentDate ?? item.paymentDate ?? undefined,
          description: item.description ?? 'Fatura de assinatura',
          billingType: item.billingType ?? 'UNDEFINED',
          invoiceUrl: item.invoiceUrl ?? undefined,
          bankSlipUrl: item.bankSlipUrl ?? undefined,
          invoiceNumber: item.invoiceNumber ?? undefined,
        }));

      return new Output(
        true,
        ['Faturas recuperadas com sucesso'],
        [],
        invoices
      );

    } catch (error) {
      console.error('Erro ao buscar faturas:', error);
      return new Output(
        false,
        [],
        ['Erro interno ao buscar faturas'],
        null
      );
    }
  }

  async cancelSubscription(supabaseId: string, reason?: string): Promise<Output> {
    try {
      // Mark optional param as intentionally unused for now
      void reason;
      // Validação
      if (!supabaseId) {
        return new Output(
          false,
          [],
          ['ID do usuário é obrigatório'],
          null
        );
      }

      // Buscar profile
      const profile = await prisma.profile.findUnique({
        where: { supabaseId }
      });

      if (!profile || !profile.subscription?.asaasSubscriptionId) {
        return new Output(
          false,
          [],
          ['Assinatura não encontrada'],
          null
        );
      }

      // Atualizar status da assinatura
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          subscriptionStatus: 'canceled',
          subscriptionEndDate: new Date()
        }
      });

      // TODO: Chamar API Asaas para cancelar assinatura
      // await asaasService.cancelSubscription(profile.subscription?.asaasSubscriptionId);

      return new Output(
        true,
        ['Assinatura cancelada com sucesso'],
        [],
        { cancelledAt: new Date().toISOString() }
      );

    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      return new Output(
        false,
        [],
        ['Erro interno ao cancelar assinatura'],
        null
      );
    }
  }

  async updatePaymentMethod(
    supabaseId: string, 
    paymentData: UpdatePaymentMethodDTO
  ): Promise<Output> {
    try {
      // Validações
      if (!supabaseId) {
        return new Output(
          false,
          [],
          ['ID do usuário é obrigatório'],
          null
        );
      }

      const errors: string[] = [];
      if (!paymentData.creditCardHolderName) errors.push('Nome do titular é obrigatório');
      if (!paymentData.creditCardNumber) errors.push('Número do cartão é obrigatório');
      if (!paymentData.creditCardExpiryMonth) errors.push('Mês de validade é obrigatório');
      if (!paymentData.creditCardExpiryYear) errors.push('Ano de validade é obrigatório');
      if (!paymentData.creditCardCcv) errors.push('CVV é obrigatório');

      if (errors.length > 0) {
        return new Output(false, [], errors, null);
      }

      // Buscar profile
      const profile = await prisma.profile.findUnique({
        where: { supabaseId }
      });

      if (!profile || !profile.subscription?.asaasSubscriptionId) {
        return new Output(
          false,
          [],
          ['Assinatura não encontrada'],
          null
        );
      }

      // TODO: Atualizar método de pagamento na API Asaas
      // await asaasService.updatePaymentMethod(
      //   profile.subscription?.asaasSubscriptionId,
      //   paymentData
      // );

      return new Output(
        true,
        ['Método de pagamento atualizado com sucesso'],
        [],
        { updatedAt: new Date().toISOString() }
      );

    } catch (error) {
      console.error('Erro ao atualizar método de pagamento:', error);
      return new Output(
        false,
        [],
        ['Erro interno ao atualizar método de pagamento'],
        null
      );
    }
  }

  async retryPayment(supabaseId: string, invoiceId: string): Promise<Output> {
    try {
      // Validações
      if (!supabaseId) {
        return new Output(
          false,
          [],
          ['ID do usuário é obrigatório'],
          null
        );
      }

      if (!invoiceId) {
        return new Output(
          false,
          [],
          ['ID da fatura é obrigatório'],
          null
        );
      }

      // Buscar profile
      const profile = await prisma.profile.findUnique({
        where: { supabaseId }
      });

      if (!profile || !profile.subscription?.asaasSubscriptionId) {
        return new Output(
          false,
          [],
          ['Assinatura não encontrada'],
          null
        );
      }

      // TODO: Retentar pagamento na API Asaas
      // await asaasService.retryPayment(invoiceId);

      return new Output(
        true,
        ['Tentativa de pagamento iniciada'],
        [],
        { retriedAt: new Date().toISOString() }
      );

    } catch (error) {
      console.error('Erro ao retentar pagamento:', error);
      return new Output(
        false,
        [],
        ['Erro interno ao retentar pagamento'],
        null
      );
    }
  }
}

// Instância única
export const subscriptionManagementUseCase = new SubscriptionManagementUseCase();
