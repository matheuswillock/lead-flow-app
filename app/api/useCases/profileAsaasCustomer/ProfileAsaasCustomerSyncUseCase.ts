import { Output } from "@/lib/output";
import {
  AsaasCustomerService,
  type AsaasCustomer,
} from "@/app/api/services/AsaasCustomer/AsaasCustomerService";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";

export type EnsureProfileAsaasCustomerResult = {
  asaasCustomerId: string;
  created: boolean;
  updated: boolean;
};

function normalizeCpfCnpj(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function isValidCpfCnpj(value: string): boolean {
  return /^\d{11}$|^\d{14}$/.test(value);
}

function buildCustomerPayload(profile: {
  id: string;
  fullName: string | null;
  email: string;
  cpfCnpj: string;
  phone: string | null;
  postalCode: string | null;
  address: string | null;
  addressNumber: string | null;
  neighborhood: string | null;
  complement: string | null;
}): AsaasCustomer {
  return {
    name: profile.fullName?.trim() || profile.email,
    email: profile.email,
    cpfCnpj: profile.cpfCnpj,
    phone: profile.phone?.replace(/\D/g, "") || undefined,
    postalCode: profile.postalCode?.replace(/\D/g, "") || undefined,
    address: profile.address || undefined,
    addressNumber: profile.addressNumber || undefined,
    complement: profile.complement || undefined,
    province: profile.neighborhood || undefined,
    externalReference: profile.id,
    notificationDisabled: true,
  };
}

export class ProfileAsaasCustomerSyncUseCase {
  async ensureProfileAsaasCustomer(profileId: string): Promise<Output> {
    try {
      const profile = await profileRepository.findAsaasSyncProfileById(profileId);

      if (!profile) {
        return new Output(false, [], ["Usuário não encontrado"], null);
      }

      const cpfCnpj = normalizeCpfCnpj(profile.cpfCnpj);
      if (!isValidCpfCnpj(cpfCnpj)) {
        return new Output(
          false,
          [],
          ["CPF/CNPJ é obrigatório e deve ser válido para contas Associado"],
          null
        );
      }

      const payload = buildCustomerPayload({ ...profile, cpfCnpj });

      if (!profile.asaasCustomerId) {
        const created = await AsaasCustomerService.createCustomer(payload);
        if (!created.success || !created.customerId) {
          return new Output(false, [], ["Erro ao criar cliente no Asaas"], null);
        }

        await profileRepository.updateAsaasCustomerId(profileId, created.customerId);
        await this.syncCustomerFacingNotificationsDisabled(created.customerId);

        return new Output(true, ["Cliente Asaas criado"], [], {
          asaasCustomerId: created.customerId,
          created: true,
          updated: false,
        } satisfies EnsureProfileAsaasCustomerResult);
      }

      try {
        await AsaasCustomerService.getCustomer(profile.asaasCustomerId);
        try {
          await AsaasCustomerService.updateCustomer(profile.asaasCustomerId, payload);
          await this.syncCustomerFacingNotificationsDisabled(profile.asaasCustomerId);
          return new Output(true, ["Cliente Asaas atualizado"], [], {
            asaasCustomerId: profile.asaasCustomerId,
            created: false,
            updated: true,
          } satisfies EnsureProfileAsaasCustomerResult);
        } catch (updateError) {
          console.error("[ProfileAsaasCustomerSyncUseCase][updateCustomer]", updateError);
          return new Output(true, ["Cliente Asaas já existente"], [], {
            asaasCustomerId: profile.asaasCustomerId,
            created: false,
            updated: false,
          } satisfies EnsureProfileAsaasCustomerResult);
        }
      } catch {
        console.info(
          "[ProfileAsaasCustomerSyncUseCase] Customer stale; recriando:",
          profile.asaasCustomerId
        );
        const created = await AsaasCustomerService.createCustomer(payload);
        if (!created.success || !created.customerId) {
          return new Output(false, [], ["Erro ao recriar cliente no Asaas"], null);
        }

        await profileRepository.updateAsaasCustomerId(profileId, created.customerId);
        await this.syncCustomerFacingNotificationsDisabled(created.customerId);

        return new Output(true, ["Cliente Asaas recriado"], [], {
          asaasCustomerId: created.customerId,
          created: true,
          updated: false,
        } satisfies EnsureProfileAsaasCustomerResult);
      }
    } catch (error) {
      console.error("[ProfileAsaasCustomerSyncUseCase][ensureProfileAsaasCustomer]", error);
      return new Output(false, [], ["Erro ao sincronizar cliente Asaas"], null);
    }
  }

  private async syncCustomerFacingNotificationsDisabled(asaasCustomerId: string): Promise<void> {
    try {
      await AsaasCustomerService.disableCustomerFacingNotifications(asaasCustomerId);
    } catch (error) {
      console.error(
        "[ProfileAsaasCustomerSyncUseCase][disableCustomerFacingNotifications]",
        { asaasCustomerId, error }
      );
    }
  }
}

export const profileAsaasCustomerSyncUseCase = new ProfileAsaasCustomerSyncUseCase();
