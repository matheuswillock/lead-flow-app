import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { getBillingSummary } from "@/app/api/services/billing/TeamBillingService";
import { asaasApi, asaasFetch } from "@/lib/asaas";
import type { 
  ISubscriptionManagementUseCase, 
  UpdatePaymentMethodDTO 
} from "./ISubscriptionManagementUseCase";

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

export class SubscriptionManagementUseCase implements ISubscriptionManagementUseCase {
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

      // Buscar profile do usuário
      const profile = await prisma.profile.findUnique({
        where: { supabaseId }
      });

      if (!profile) {
        return new Output(
          false,
          [],
          ['Usuário não encontrado'],
          null
        );
      }

      // Assinatura é sempre gerida pelo master pagante.
      // Para manter compatibilidade com cenários legados, quando um usuário não-master consultar,
      // usamos o managerId como masterId, se existir.
      const masterIdForBilling = profile.isMaster ? profile.id : profile.managerId;

      // Verificar se tem asaasSubscriptionId (campo mais confiável)
      if (!profile.asaasSubscriptionId && !profile.hasPermanentSubscription) {
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
      if (masterIdForBilling) {
        try {
          billingSummary = await getBillingSummary(masterIdForBilling);
        } catch (err) {
          console.warn("[SubscriptionManagementUseCase] Falha ao calcular billing summary:", err);
          billingSummary = null;
        }
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
      const totalValue =
        profile.hasPermanentSubscription
          ? 0
          : profile.subscriptionPlan === "free_trial"
            ? 0
            : billingSummary?.totalPrice ?? Number(legacyTotal.toFixed(2));

      // Formatar dados da assinatura
      const subscriptionData = {
        id: profile.asaasSubscriptionId || 'permanent-subscription',
        subscriptionAsaasId: profile.asaasSubscriptionId || 'permanent-subscription',
        status: profile.hasPermanentSubscription ? 'active' : (profile.subscriptionStatus || 'active'),
        value: totalValue,
        nextDueDate: profile.subscriptionNextDueDate?.toISOString() || profile.subscriptionEndDate?.toISOString() || '',
        cycle: profile.subscriptionCycle || 'MONTHLY',
        description: profile.hasPermanentSubscription ? 'Assinatura Vitalícia (Sem Custo)' :
                     profile.subscriptionPlan === 'free_trial' ? 'Período de teste' :
                     profile.subscriptionPlan === 'manager_base' ? 'Plano Manager Base' :
                     `Plano Manager Base`,
        billingType: 'CREDIT_CARD',
        hasPermanentSubscription: profile.hasPermanentSubscription || false,
        customer: {
          name: profile.fullName || 'Usuário',
          email: profile.email
        },
        externalReference: profile.asaasCustomerId || undefined,
        createdAt: profile.subscriptionStartDate?.toISOString() || profile.createdAt.toISOString(),
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
          plan: profile.subscriptionPlan,
          // Mantemos operatorCount por compatibilidade (UI antiga). Agora representa usuários cobrados (distinct, exceto master).
          operatorCount: billingSummary?.billableUsers ?? actualOperatorCount,
          teamCount: billingSummary?.teamCount,
          distinctUserCount: billingSummary?.distinctUserCount,
          trialEndDate: profile.trialEndDate?.toISOString()
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
          asaasCustomerId: true,
          asaasSubscriptionId: true,
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

      let customerId = profile.asaasCustomerId;

      // Fallback para cenários legados onde o customer não foi persistido no profile
      if (!customerId && profile.asaasSubscriptionId) {
        try {
          const subscription = await asaasFetch(
            `${asaasApi.subscriptions}/${profile.asaasSubscriptionId}`,
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

      if (!profile || !profile.subscriptionId) {
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
      // await asaasService.cancelSubscription(profile.subscriptionId);

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

      if (!profile || !profile.subscriptionId) {
        return new Output(
          false,
          [],
          ['Assinatura não encontrada'],
          null
        );
      }

      // TODO: Atualizar método de pagamento na API Asaas
      // await asaasService.updatePaymentMethod(
      //   profile.subscriptionId,
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

      if (!profile || !profile.subscriptionId) {
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
