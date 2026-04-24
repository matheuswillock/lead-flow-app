import { billingRepository } from "@/app/api/infra/data/repositories/billing/BillingRepository";
import { BILLING_PRICES, type BillingSummary } from "@/app/api/shared/billing/billingConfig";
import { asaasApi, asaasFetch } from "@/lib/asaas";
import { addMonthsInTz, formatInTz, DEFAULT_TZ } from "@/lib/dates";
import type {
  BillingOwnerProfile,
  CreateIncrementalChargeInput,
  IIncrementalBillingService,
  IncrementalBillingType,
  IncrementalChargeResult,
  ProjectBillingInput,
  ProjectedBillingSummary,
  SyncRecurringSubscriptionInput,
} from "./IIncrementalBillingService";

type AsaasCycle = "MONTHLY" | "WEEKLY" | "BIWEEKLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY";

type AsaasSubscriptionDetails = {
  id: string;
  billingType: string;
  cycle: AsaasCycle | string;
  description?: string;
  nextDueDate?: string;
  creditCard?: {
    creditCardToken?: string;
    creditCardNumber?: string;
    creditCardBrand?: string;
  };
};

type AsaasSubscriptionCreationPayload = {
  customer: string;
  billingType: "CREDIT_CARD";
  value: number;
  cycle: AsaasCycle;
  nextDueDate: string;
  description?: string;
  externalReference: string;
  creditCardToken: string;
};

const isBillingType = (value: string): value is IncrementalBillingType =>
  value === "PIX" || value === "BOLETO" || value === "CREDIT_CARD" || value === "UNDEFINED";

const normalizeBillingType = (value: string | null | undefined): IncrementalBillingType => {
  if (!value) return "UNDEFINED";
  return isBillingType(value) ? value : "UNDEFINED";
};

const normalizeAsaasCycle = (value: string | null | undefined): AsaasCycle => {
  switch (value) {
    case "WEEKLY":
    case "BIWEEKLY":
    case "QUARTERLY":
    case "SEMIANNUALLY":
    case "YEARLY":
      return value;
    case "MONTHLY":
    default:
      return "MONTHLY";
  }
};

const roundCurrency = (value: number) => Number(value.toFixed(2));

const createAsaasCustomer = async (master: BillingOwnerProfile): Promise<string> => {
  const customer = await asaasFetch(asaasApi.customers, {
    method: "POST",
    body: JSON.stringify({
      name: master.fullName || master.email,
      email: master.email,
      cpfCnpj: master.cpfCnpj || "",
      phone: master.phone || undefined,
      postalCode: master.postalCode || undefined,
      address: master.address || undefined,
      addressNumber: master.addressNumber || undefined,
      complement: master.complement || undefined,
      province: master.neighborhood || undefined,
      externalReference: master.id,
    }),
  });

  return customer.id as string;
};

const getAsaasSubscription = async (subscriptionId: string): Promise<AsaasSubscriptionDetails> => {
  return asaasFetch(`${asaasApi.subscriptions}/${subscriptionId}`, {
    method: "GET",
  });
};

const updateAsaasSubscription = async (
  subscriptionId: string,
  data: { value: number; updatePendingPayments: boolean }
): Promise<void> => {
  await asaasFetch(`${asaasApi.subscriptions}/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

const createAsaasSubscription = async (data: AsaasSubscriptionCreationPayload) => {
  const subscription = await asaasFetch(asaasApi.subscriptions, {
    method: "POST",
    body: JSON.stringify(data),
  });

  return {
    subscriptionId: subscription.id as string,
    data: subscription as { nextDueDate: string; cycle?: string },
  };
};

const cancelAsaasSubscription = async (subscriptionId: string): Promise<void> => {
  await asaasFetch(`${asaasApi.subscriptions}/${subscriptionId}`, {
    method: "DELETE",
  });
};

const getPixQrCode = async (paymentId: string) => {
  const data = await asaasFetch(asaasApi.pixQrCode(paymentId), { method: "GET" });
  return {
    encodedImage: data?.encodedImage as string,
    payload: data?.payload as string,
    expirationDate: data?.expirationDate as string,
  };
};

const getBoletoIdentificationField = async (paymentId: string) => {
  const data = await asaasFetch(`${asaasApi.payments}/${paymentId}/identificationField`, {
    method: "GET",
  });
  return {
    identificationField: data?.identificationField as string,
    barCode: data?.barCode as string,
  };
};

export class IncrementalBillingService implements IIncrementalBillingService {
  async projectBilling(masterId: string, input: ProjectBillingInput): Promise<ProjectedBillingSummary> {
    const snapshot = await billingRepository.getBillingSnapshot(masterId);

    if (!snapshot) {
      throw new Error("Master não encontrado");
    }

    const currentBillableTeams = Math.max(0, snapshot.teamCount - 1);
    const currentBillableUsers = Math.max(0, snapshot.totalUsersIncludingMaster - 1);
    const basePrice = BILLING_PRICES.base;
    const extraTeamsPrice = currentBillableTeams * BILLING_PRICES.extraTeam;
    const extraUsersPrice = currentBillableUsers * BILLING_PRICES.extraUser;
    const currentSummary: BillingSummary = {
      masterId,
      teamCount: snapshot.teamCount,
      distinctUserCount: snapshot.distinctUserCount,
      totalUsersIncludingMaster: snapshot.totalUsersIncludingMaster,
      billableTeams: currentBillableTeams,
      billableUsers: currentBillableUsers,
      basePrice,
      extraTeamsPrice,
      extraUsersPrice,
      totalPrice: snapshot.hasPermanentSubscription
        ? 0
        : roundCurrency(basePrice + extraTeamsPrice + extraUsersPrice),
      hasPermanentSubscription: snapshot.hasPermanentSubscription,
    };

    const additionalTeams = Math.max(0, input.additionalTeams ?? 0);
    const additionalUsers = Math.max(0, input.additionalUsers ?? 0);
    const nextTeamCount = currentSummary.teamCount + additionalTeams;
    const nextTotalUsersIncludingMaster = currentSummary.totalUsersIncludingMaster + additionalUsers;
    const nextBillableTeams = Math.max(0, nextTeamCount - 1);
    const nextBillableUsers = Math.max(0, nextTotalUsersIncludingMaster - 1);
    const targetRecurringTotal = currentSummary.hasPermanentSubscription
      ? 0
      : roundCurrency(
          currentSummary.basePrice +
            nextBillableTeams * BILLING_PRICES.extraTeam +
            nextBillableUsers * BILLING_PRICES.extraUser
        );
    const billingDelta = currentSummary.hasPermanentSubscription
      ? 0
      : roundCurrency(Math.max(0, targetRecurringTotal - currentSummary.totalPrice));

    return {
      currentSummary,
      nextTeamCount,
      nextTotalUsersIncludingMaster,
      nextBillableTeams,
      nextBillableUsers,
      targetRecurringTotal,
      billingDelta,
    };
  }

  async createIncrementalCharge(input: CreateIncrementalChargeInput): Promise<IncrementalChargeResult> {
    const customerId = await this.ensureCustomer(input.master);
    const subscription = await this.getCurrentSubscription(input.master);
    const billingType = normalizeBillingType(subscription.billingType);
    const dueDate = new Date().toISOString().slice(0, 10);
    const externalReference = `pending-action-${input.pendingActionId}`;
    const paymentPayload: Record<string, unknown> = {
      customer: customerId,
      billingType,
      value: roundCurrency(input.amount),
      dueDate,
      description: input.description,
      externalReference,
    };

    if (billingType === "CREDIT_CARD") {
      const creditCardToken = subscription.creditCard?.creditCardToken;
      if (!creditCardToken) {
        throw new Error(
          "A assinatura em cartão não possui tokenização ativa para cobrança incremental imediata."
        );
      }
      paymentPayload.creditCardToken = creditCardToken;
    }

    const payment = await asaasFetch(asaasApi.payments, {
      method: "POST",
      body: JSON.stringify(paymentPayload),
    });

    const result: IncrementalChargeResult = {
      paymentId: payment.id,
      paymentStatus: payment.status || "PENDING",
      billingType,
      amount: roundCurrency(input.amount),
      dueDate,
      externalReference,
    };

    if (billingType === "PIX") {
      result.pix = await getPixQrCode(payment.id);
    }

    if (billingType === "BOLETO") {
      const boleto = await getBoletoIdentificationField(payment.id);
      result.boleto = {
        bankSlipUrl: payment.bankSlipUrl || payment.invoiceUrl || null,
        identificationField: boleto.identificationField,
        barCode: boleto.barCode,
        dueDate: payment.dueDate || null,
      };
    }

    return result;
  }

  async syncRecurringSubscription(input: SyncRecurringSubscriptionInput): Promise<void> {
    const { master, targetRecurringTotal, reason } = input;

    if (master.hasPermanentSubscription || !master.asaasSubscriptionId) {
      return;
    }

    const currentSubscription = await this.getCurrentSubscription(master);
    const billingType = normalizeBillingType(currentSubscription.billingType);

    if (billingType !== "CREDIT_CARD") {
      await updateAsaasSubscription(master.asaasSubscriptionId, {
        value: roundCurrency(targetRecurringTotal),
        updatePendingPayments: true,
      });
      return;
    }

    try {
      await updateAsaasSubscription(master.asaasSubscriptionId, {
        value: roundCurrency(targetRecurringTotal),
        updatePendingPayments: true,
      });
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      const normalizedMessage = errorMessage.toLowerCase();
      const blockedValueChange =
        normalizedMessage.includes("nao e possivel alterar o valor") ||
        normalizedMessage.includes("não é possível alterar o valor") ||
        normalizedMessage.includes("assinaturas via cartao de credito") ||
        normalizedMessage.includes("assinaturas via cartão de crédito");

      if (!blockedValueChange) {
        throw error;
      }
    }

    const creditCardToken = currentSubscription.creditCard?.creditCardToken;
    if (!creditCardToken) {
      throw new Error(
        "A assinatura em cartão não possui tokenização ativa para atualizar o valor recorrente."
      );
    }

    const nextDueDate = this.resolveNextDueDate(master, currentSubscription);
    const newSubscription = await createAsaasSubscription({
      customer: await this.ensureCustomer(master),
      billingType: "CREDIT_CARD",
      value: roundCurrency(targetRecurringTotal),
      cycle: normalizeAsaasCycle(currentSubscription.cycle),
      nextDueDate,
      description: currentSubscription.description || reason,
      externalReference: `manager-${master.id}-${Date.now()}`,
      creditCardToken,
    });

    await billingRepository.updateSubscriptionData(master.id, {
      asaasSubscriptionId: newSubscription.subscriptionId,
      subscriptionNextDueDate: new Date(newSubscription.data.nextDueDate),
      subscriptionCycle: newSubscription.data.cycle || "MONTHLY",
    });

    try {
      await cancelAsaasSubscription(currentSubscription.id);
    } catch (error) {
      console.error("[IncrementalBillingService] Falha ao cancelar assinatura antiga:", error);
    }
  }

  private async ensureCustomer(master: BillingOwnerProfile): Promise<string> {
    if (master.asaasCustomerId) {
      try {
        await asaasFetch(`${asaasApi.customers}/${master.asaasCustomerId}`, { method: "GET" });
        return master.asaasCustomerId;
      } catch (error) {
        console.info("[IncrementalBillingService] Cliente Asaas desatualizado, recriando cadastro.", error);
      }
    }

    const customerId = await createAsaasCustomer(master);
    await billingRepository.updateAsaasCustomerId(master.id, customerId);
    return customerId;
  }

  private async getCurrentSubscription(master: BillingOwnerProfile): Promise<AsaasSubscriptionDetails> {
    if (!master.asaasSubscriptionId) {
      throw new Error("Master não possui assinatura ativa configurada.");
    }

    return getAsaasSubscription(master.asaasSubscriptionId);
  }

  private resolveNextDueDate(master: BillingOwnerProfile, currentSubscription: AsaasSubscriptionDetails): string {
    const now = new Date();
    const ownerTz = master.timezone ?? DEFAULT_TZ;
    const currentNextDueDate = master.subscriptionNextDueDate
      ? new Date(master.subscriptionNextDueDate)
      : currentSubscription.nextDueDate
        ? new Date(currentSubscription.nextDueDate)
        : null;

    let nextDueDate =
      currentNextDueDate && !Number.isNaN(currentNextDueDate.getTime()) ? currentNextDueDate : now;

    if (nextDueDate < now) {
      nextDueDate = addMonthsInTz(nextDueDate, 1, ownerTz);
    }

    // Asaas espera yyyy-MM-dd no fuso do cliente (BRT), não em UTC
    return formatInTz(nextDueDate, "yyyy-MM-dd", ownerTz);
  }
}

export const incrementalBillingService = new IncrementalBillingService();
