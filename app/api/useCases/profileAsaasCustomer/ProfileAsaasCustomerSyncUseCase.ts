import { Output } from "@/lib/output";
import {
  AsaasCustomerService,
  type AsaasCustomer,
} from "@/app/api/services/AsaasCustomer/AsaasCustomerService";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import {
  buildDisableCustomerFacingNotificationPatch,
  createAsaasClient,
  type AsaasAccountId,
  type AsaasCustomerNotification,
} from "@/lib/asaas";

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
        // Criação sempre nasce na primary (DA1/DA6, via AsaasCustomerGateway).
        await this.syncCustomerFacingNotificationsDisabled(created.customerId, "primary");

        return new Output(true, ["Cliente Asaas criado"], [], {
          asaasCustomerId: created.customerId,
          created: true,
          updated: false,
        } satisfies EnsureProfileAsaasCustomerResult);
      }

      // E9 (C25/DA1): GET/PUT roteiam pela conta do próprio profile — nunca
      // pelo transporte global primary-only (AsaasCustomerService.*). E um
      // erro nesse GET nunca vira "cadastro desatualizado, recriar": isso
      // sobrescreveria asaasCustomerId fora do gateway/ledger, exatamente o
      // padrão de self-heal que destrói o índice de reconciliação (C14/C28).
      const account = profile.asaasCustomerAccount;
      const client = createAsaasClient(account);

      try {
        await client.request(`${client.endpoints.customers}/${profile.asaasCustomerId}`, {
          method: "GET",
        });
      } catch (error) {
        console.error(
          "[ProfileAsaasCustomerSyncUseCase] GET falhou — não recriando (DA1)",
          { profileId, asaasCustomerId: profile.asaasCustomerId, account, error }
        );
        return new Output(
          false,
          [],
          [
            `Cliente Asaas ${profile.asaasCustomerId} (conta ${account}) não pôde ser lido. ` +
              "Recriação de customer é passo explícito do runbook de migração " +
              "([[30 — Migração de Conta (execução) — Backend]]), nunca automática.",
          ],
          null
        );
      }

      try {
        await client.request(`${client.endpoints.customers}/${profile.asaasCustomerId}`, {
          method: "PUT",
          body: JSON.stringify({ ...payload, notificationDisabled: true }),
        });
        await this.syncCustomerFacingNotificationsDisabled(profile.asaasCustomerId, account);
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
    } catch (error) {
      console.error("[ProfileAsaasCustomerSyncUseCase][ensureProfileAsaasCustomer]", error);
      return new Output(false, [], ["Erro ao sincronizar cliente Asaas"], null);
    }
  }

  private async syncCustomerFacingNotificationsDisabled(
    asaasCustomerId: string,
    account: AsaasAccountId
  ): Promise<void> {
    try {
      const client = createAsaasClient(account);
      const existing = await client.request(client.endpoints.customerNotifications(asaasCustomerId), {
        method: "GET",
      });
      const notifications: AsaasCustomerNotification[] = Array.isArray(existing?.data)
        ? existing.data
        : [];
      if (notifications.length === 0) return;

      const patch = notifications.map((item) => buildDisableCustomerFacingNotificationPatch(item));
      await client.request(client.endpoints.notificationsBatch, {
        method: "POST",
        body: JSON.stringify({ customer: asaasCustomerId, notifications: patch }),
      });
    } catch (error) {
      console.error(
        "[ProfileAsaasCustomerSyncUseCase][disableCustomerFacingNotifications]",
        { asaasCustomerId, account, error }
      );
    }
  }
}

export const profileAsaasCustomerSyncUseCase = new ProfileAsaasCustomerSyncUseCase();
