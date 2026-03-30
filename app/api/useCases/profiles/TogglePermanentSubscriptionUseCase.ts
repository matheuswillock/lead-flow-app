// app/api/useCases/profiles/TogglePermanentSubscriptionUseCase.ts
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { asaasFetch, asaasApi } from "@/lib/asaas";
import type { ITogglePermanentSubscriptionUseCase } from "./ITogglePermanentSubscriptionUseCase";

export interface FreeSubscriptionOptions {
  /** Data de início da assinatura (default: hoje) */
  startDate?: string; // ISO yyyy-mm-dd
  /** Data de término da assinatura (default: 1 ano a partir do startDate) */
  endDate?: string; // ISO yyyy-mm-dd
}

export class TogglePermanentSubscriptionUseCase implements ITogglePermanentSubscriptionUseCase {
  /**
   * Torna um profile vitalício ou remove a assinatura permanente.
   * Ao ativar, cria assinatura R$0,00 no Asaas (se o profile já tiver asaasCustomerId).
   * Ao desativar, cancela a assinatura gratuita no Asaas.
   */
  async togglePermanentSubscription(
    profileId: string,
    enable: boolean,
    options?: FreeSubscriptionOptions
  ): Promise<Output> {
    try {
      if (!profileId) {
        return new Output(false, [], ['Profile ID é obrigatório'], null);
      }

      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          hasPermanentSubscription: true,
          asaasCustomerId: true,
          asaasSubscriptionId: true,
          subscriptionPlan: true,
        },
      });

      if (!profile) {
        return new Output(false, [], ['Profile não encontrado'], null);
      }

      if (enable) {
        return await this.enablePermanentSubscription(profile, options);
      }

      return await this.disablePermanentSubscription(profile);
    } catch (error) {
      console.error('❌ [TogglePermanentSubscription] Erro inesperado:', error);
      return new Output(false, [], ['Erro ao atualizar assinatura permanente'], null);
    }
  }

  private async enablePermanentSubscription(
    profile: {
      id: string;
      email: string;
      fullName: string | null;
      asaasCustomerId: string | null;
      asaasSubscriptionId: string | null;
    },
    options?: FreeSubscriptionOptions
  ): Promise<Output> {
    const now = new Date();

    const startDate = options?.startDate
      ? new Date(options.startDate)
      : now;

    const endDate = options?.endDate
      ? new Date(options.endDate)
      : new Date(new Date(startDate).setFullYear(startDate.getFullYear() + 1));

    const startDateStr = startDate.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    let asaasSubscriptionId: string | null = profile.asaasSubscriptionId ?? null;

    // Criar assinatura R$0,00 no Asaas somente se o customer já existir
    if (profile.asaasCustomerId) {
      try {
        console.info('[TogglePermanentSubscription] Criando assinatura gratuita no Asaas:', {
          customerId: profile.asaasCustomerId,
          startDate: startDateStr,
          endDate: endDateStr,
        });

        const subscription = await asaasFetch(asaasApi.subscriptions, {
          method: 'POST',
          body: JSON.stringify({
            customer: profile.asaasCustomerId,
            billingType: 'UNDEFINED',
            value: 0,
            cycle: 'MONTHLY',
            nextDueDate: startDateStr,
            endDate: endDateStr,
            description: 'Lead Flow – Acesso Vitalício',
            externalReference: profile.id,
          }),
        });

        asaasSubscriptionId = subscription.id ?? null;
        console.info('[TogglePermanentSubscription] Assinatura gratuita criada no Asaas:', asaasSubscriptionId);
      } catch (asaasError: any) {
        // Não bloquear o fluxo: logar e prosseguir sem asaasSubscriptionId
        console.error('[TogglePermanentSubscription] Falha ao criar assinatura no Asaas (prosseguindo):', asaasError?.message);
      }
    } else {
      console.info('[TogglePermanentSubscription] Profile sem asaasCustomerId – assinatura Asaas não criada:', profile.id);
    }

    const updated = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        hasPermanentSubscription: true,
        subscriptionStatus: 'active',
        subscriptionPlan: 'free_trial',
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        ...(asaasSubscriptionId ? { asaasSubscriptionId } : {}),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        hasPermanentSubscription: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
        asaasSubscriptionId: true,
      },
    });

    console.info('✅ [TogglePermanentSubscription] Assinatura permanente ativada:', {
      profileId: updated.id,
      email: updated.email,
      asaasSubscriptionId: updated.asaasSubscriptionId,
      startDate: updated.subscriptionStartDate,
      endDate: updated.subscriptionEndDate,
    });

    return new Output(true, ['Assinatura permanente ativada com sucesso'], [], updated);
  }

  private async disablePermanentSubscription(profile: {
    id: string;
    email: string;
    asaasCustomerId: string | null;
    asaasSubscriptionId: string | null;
    subscriptionPlan: string | null;
  }): Promise<Output> {
    // Cancelar no Asaas somente se for assinatura gratuita (free_trial)
    if (profile.asaasSubscriptionId && profile.subscriptionPlan === 'free_trial') {
      try {
        await asaasFetch(`${asaasApi.subscriptions}/${profile.asaasSubscriptionId}`, {
          method: 'DELETE',
        });
        console.info('[TogglePermanentSubscription] Assinatura gratuita cancelada no Asaas:', profile.asaasSubscriptionId);
      } catch (asaasError: any) {
        console.error('[TogglePermanentSubscription] Falha ao cancelar assinatura no Asaas (prosseguindo):', asaasError?.message);
      }
    }

    const updated = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        hasPermanentSubscription: false,
        subscriptionStatus: 'canceled',
        subscriptionPlan: null,
        subscriptionStartDate: null,
        subscriptionEndDate: null,
        asaasSubscriptionId: null,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        hasPermanentSubscription: true,
        subscriptionStatus: true,
      },
    });

    console.info('✅ [TogglePermanentSubscription] Assinatura permanente desativada:', {
      profileId: updated.id,
      email: updated.email,
    });

    return new Output(true, ['Assinatura permanente desativada com sucesso'], [], updated);
  }
}

// Instância única
export const togglePermanentSubscriptionUseCase = new TogglePermanentSubscriptionUseCase();
