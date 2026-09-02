import { billingRepository } from "@/app/api/infra/data/repositories/billing/BillingRepository";
import { BILLING_PRICES, type BillingSummary } from "@/app/api/shared/billing/billingConfig";
import { asaasApi, asaasFetch, createAsaasClient, type AsaasAccountId } from "@/lib/asaas";
import { asaasCustomerGateway } from "@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway";
import { addMonthsInTz, formatIntimezone, DEFAULT_TZ } from "@/lib/dates";
import { buildBillingSummary } from "./TeamBillingService";
import type {
  BillingOwnerProfile,
  CreateIncrementalChargeInput,
  EnsureOrSyncRecurringSubscriptionInput,
  IIncrementalBillingService,
  IncrementalBillingType,
  IncrementalChargeCustomerOverride,
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
  billingType: "CREDIT_CARD" | "PIX";
  value: number;
  cycle: AsaasCycle;
  nextDueDate: string;
  description?: string;
  externalReference: string;
  creditCardToken?: string;
};

const isRealAsaasSubscriptionId = (subscriptionId: string | null | undefined): boolean => {
  if (!subscriptionId) return false;
  if (subscriptionId.startsWith("external-adhesion-")) return false;
  if (subscriptionId.startsWith("adhesion-")) return false;
  return true;
};

const formatDueDate = (value: Date | string, timezone: string): string => {
  const date = value instanceof Date ? value : new Date(value);
  return formatIntimezone(date, "yyyy-MM-dd", timezone);
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

// E5 de [[10 — Fundações Multi-conta — Backend]] (DA5/M4.8): criação de
// customer passa pelo AsaasCustomerGateway — nunca POST /customers direto.
const createAsaasCustomer = async (master: BillingOwnerProfile): Promise<string> => {
  const customer = await asaasCustomerGateway.createCustomer({
    profileId: master.id,
    name: master.fullName || master.email,
    email: master.email,
    cpfCnpj: master.cpfCnpj || "",
    phone: master.phone || undefined,
    postalCode: master.postalCode || undefined,
    address: master.address || undefined,
    addressNumber: master.addressNumber || undefined,
    complement: master.complement || undefined,
    province: master.neighborhood || undefined,
  });

  return customer.id;
};

const createAsaasCustomerFromOverride = async (
  masterId: string,
  override: IncrementalChargeCustomerOverride
): Promise<string> => {
  const customer = await asaasCustomerGateway.createCustomer({
    profileId: masterId,
    name: override.fullName,
    email: override.email,
    cpfCnpj: override.cpfCnpj || "",
    phone: override.phone || undefined,
    postalCode: override.postalCode || undefined,
    address: override.address || undefined,
    addressNumber: override.addressNumber || undefined,
    complement: override.complement || undefined,
    province: override.neighborhood || undefined,
  });

  return customer.id;
};

// E2 de [[40 — Checkout, Adesões e Add-ons — Backend]] (DA2): toda operação
// sobre assinatura/pagamento armazenado roteia pela conta do dono (master),
// nunca pelo transporte global primary-only.
const getAsaasSubscription = async (
  subscriptionId: string,
  account: AsaasAccountId
): Promise<AsaasSubscriptionDetails> => {
  const client = createAsaasClient(account);
  return client.request(`${client.endpoints.subscriptions}/${subscriptionId}`, {
    method: "GET",
  });
};

const updateAsaasSubscription = async (
  subscriptionId: string,
  account: AsaasAccountId,
  data: { value: number; updatePendingPayments: boolean; nextDueDate?: string }
): Promise<void> => {
  const client = createAsaasClient(account);
  await client.request(`${client.endpoints.subscriptions}/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

// Criação de assinatura nova é categoria (a) do censo de call-sites — nasce
// sempre na conta primary, nunca na legacy (que é somente-leitura, DA1).
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

const cancelAsaasSubscription = async (subscriptionId: string, account: AsaasAccountId): Promise<void> => {
  const client = createAsaasClient(account);
  await client.request(`${client.endpoints.subscriptions}/${subscriptionId}`, {
    method: "DELETE",
  });
};

const getPixQrCode = async (paymentId: string, account: AsaasAccountId) => {
  const client = createAsaasClient(account);
  const data = await client.request(client.endpoints.pixQrCode(paymentId), { method: "GET" });
  return {
    encodedImage: data?.encodedImage as string,
    payload: data?.payload as string,
    expirationDate: data?.expirationDate as string,
  };
};

const getBoletoIdentificationField = async (paymentId: string, account: AsaasAccountId) => {
  const client = createAsaasClient(account);
  const data = await client.request(`${client.endpoints.payments}/${paymentId}/identificationField`, {
    method: "GET",
  });
  return {
    identificationField: data?.identificationField as string,
    barCode: data?.barCode as string,
  };
};

// DA1: token de cartão é por conta — reusar o token de uma assinatura legacy
// para cobrar ou criar uma assinatura nova na primary sempre falha (ou pior,
// cobra o cartão errado). Reautorização é passo explícito da F6 do runbook.
const assertCreditCardTokenTransferable = (account: AsaasAccountId): void => {
  if (account === "legacy") {
    throw new Error(
      "Cobrança em cartão de crédito de assinatura da conta legada requer reautorização do " +
        "cartão na conta nova antes de prosseguir — o token não atravessa contas Asaas. " +
        "Aguarda a F6 do runbook de migração ([[30 — Migração de Conta (execução) — Backend]])."
    );
  }
};

export class IncrementalBillingService implements IIncrementalBillingService {
  async projectBilling(masterId: string, input: ProjectBillingInput): Promise<ProjectedBillingSummary> {
    const snapshot = await billingRepository.getBillingSnapshot(masterId);

    if (!snapshot) {
      throw new Error("Master não encontrado");
    }

    const currentSummary: BillingSummary = buildBillingSummary(masterId, snapshot);

    const additionalTeams = Math.max(0, input.additionalTeams ?? 0);
    const additionalUsers = Math.max(0, input.additionalUsers ?? 0);
    const nextTeamCount = currentSummary.teamCount + additionalTeams;
    const nextTotalUsersIncludingMaster = currentSummary.totalUsersIncludingMaster + additionalUsers;
    const nextRawExtraTeams = Math.max(0, nextTeamCount - 1);
    const nextRawExtraUsers = Math.max(0, nextTotalUsersIncludingMaster - 1);
    const nextBillableTeams = Math.max(nextRawExtraTeams, currentSummary.contractedExtraTeams);
    const nextBillableUsers = currentSummary.hasUnlimitedUsers
      ? 0
      : Math.max(nextRawExtraUsers, currentSummary.contractedExtraUsers);
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
    const customerId = await this.ensureCustomer(input.master, input.customerOverride);

    let billingType: IncrementalBillingType = "UNDEFINED";
    let creditCardToken: string | undefined;
    const hasCreditCardForm = input.billingType === "CREDIT_CARD" && Boolean(input.creditCard);

    if (input.billingType === "PIX") {
      billingType = "PIX";
    } else if (input.billingType === "CREDIT_CARD") {
      billingType = "CREDIT_CARD";
      if (!hasCreditCardForm && input.master.asaasSubscriptionId) {
        const subscription = await this.getCurrentSubscription(input.master);
        if (subscription.billingType === "CREDIT_CARD") {
          assertCreditCardTokenTransferable(input.master.asaasSubscriptionAccount);
          creditCardToken = subscription.creditCard?.creditCardToken;
        }
      }
    } else if (input.master.asaasSubscriptionId) {
      const subscription = await this.getCurrentSubscription(input.master);
      billingType = normalizeBillingType(subscription.billingType);
      if (billingType === "CREDIT_CARD") {
        assertCreditCardTokenTransferable(input.master.asaasSubscriptionAccount);
        creditCardToken = subscription.creditCard?.creditCardToken;
        if (!creditCardToken) {
          throw new Error(
            "A assinatura em cartão não possui tokenização ativa para cobrança incremental imediata."
          );
        }
      }
    }

    const ownerTz = input.master.timezone ?? DEFAULT_TZ;
    const dueDate = formatIntimezone(new Date(), "yyyy-MM-dd", ownerTz);
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
      if (hasCreditCardForm && input.creditCard) {
        const holder = input.customerOverride ?? {
          fullName: input.master.fullName ?? "",
          email: input.master.email,
          cpfCnpj: input.master.cpfCnpj ?? "",
          phone: input.master.phone ?? "",
          postalCode: input.master.postalCode ?? "",
          addressNumber: input.master.addressNumber ?? "",
          complement: input.master.complement ?? undefined,
        };
        paymentPayload.creditCard = {
          holderName: input.creditCard.holderName,
          number: input.creditCard.number,
          expiryMonth: input.creditCard.expiryMonth,
          expiryYear: input.creditCard.expiryYear,
          ccv: input.creditCard.ccv,
        };
        paymentPayload.creditCardHolderInfo = {
          name: holder.fullName,
          email: holder.email,
          cpfCnpj: holder.cpfCnpj,
          postalCode: holder.postalCode,
          addressNumber: holder.addressNumber,
          addressComplement: holder.complement,
          phone: holder.phone,
          mobilePhone: holder.phone,
        };
        if (input.remoteIp) {
          paymentPayload.remoteIp = input.remoteIp;
        }
        if ((input.installments ?? 1) > 1) {
          paymentPayload.installmentCount = input.installments;
          paymentPayload.installmentValue = roundCurrency(
            input.amount / Math.max(input.installments ?? 1, 1)
          );
        }
      } else if (creditCardToken) {
        paymentPayload.creditCardToken = creditCardToken;
      }
    }

    // O pagamento pertence ao customer resolvido em ensureCustomer — precisa
    // ir para a mesma conta onde esse customer vive (DA2), nunca para o
    // transporte global primary-only.
    const chargeAccount = input.master.asaasCustomerAccount;
    const chargeClient = createAsaasClient(chargeAccount);
    const payment = await chargeClient.request(chargeClient.endpoints.payments, {
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
      result.pix = await getPixQrCode(payment.id, chargeAccount);
      result.invoiceUrl = payment.invoiceUrl || null;
    }

    if (billingType === "BOLETO") {
      const boleto = await getBoletoIdentificationField(payment.id, chargeAccount);
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
    const { master, targetRecurringTotal, reason, nextDueDateOverride } = input;

    if (master.hasPermanentSubscription || !isRealAsaasSubscriptionId(master.asaasSubscriptionId)) {
      return;
    }

    const ownerTz = master.timezone ?? DEFAULT_TZ;
    const formattedOverride =
      nextDueDateOverride != null ? formatDueDate(nextDueDateOverride, ownerTz) : undefined;

    const account = master.asaasSubscriptionAccount;
    const currentSubscription = await this.getCurrentSubscription(master);
    const billingType = normalizeBillingType(currentSubscription.billingType);
    const updatePayload: { value: number; updatePendingPayments: boolean; nextDueDate?: string } = {
      value: roundCurrency(targetRecurringTotal),
      updatePendingPayments: true,
    };
    if (formattedOverride) {
      updatePayload.nextDueDate = formattedOverride;
    }

    if (billingType !== "CREDIT_CARD") {
      await updateAsaasSubscription(master.asaasSubscriptionId!, account, updatePayload);
      if (formattedOverride) {
        await billingRepository.updateSubscriptionData(master.id, {
          asaasSubscriptionId: master.asaasSubscriptionId!,
          subscriptionNextDueDate: new Date(formattedOverride),
          subscriptionCycle: currentSubscription.cycle || master.subscriptionCycle || "MONTHLY",
        });
      }
      return;
    }

    try {
      await updateAsaasSubscription(master.asaasSubscriptionId!, account, updatePayload);
      if (formattedOverride) {
        await billingRepository.updateSubscriptionData(master.id, {
          asaasSubscriptionId: master.asaasSubscriptionId!,
          subscriptionNextDueDate: new Date(formattedOverride),
          subscriptionCycle: currentSubscription.cycle || master.subscriptionCycle || "MONTHLY",
        });
      }
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

    // Asaas recusa PUT de valor em assinatura de cartão — o único jeito é
    // recriar a assinatura reusando o token do cartão. Token não atravessa
    // contas (DA1): se a assinatura é legacy, isso é reautorização (F6), não
    // um catch automático.
    assertCreditCardTokenTransferable(account);

    const creditCardToken = currentSubscription.creditCard?.creditCardToken;
    if (!creditCardToken) {
      throw new Error(
        "A assinatura em cartão não possui tokenização ativa para atualizar o valor recorrente."
      );
    }

    const nextDueDate =
      formattedOverride ?? this.resolveNextDueDate(master, currentSubscription);
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
      await cancelAsaasSubscription(currentSubscription.id, account);
    } catch (error) {
      console.error("[IncrementalBillingService] Falha ao cancelar assinatura antiga:", error);
    }
  }

  async ensureOrSyncRecurringSubscription(
    input: EnsureOrSyncRecurringSubscriptionInput
  ): Promise<void> {
    const { master, defaultBillingType = "PIX" } = input;

    if (master.hasPermanentSubscription) {
      return;
    }

    if (isRealAsaasSubscriptionId(master.asaasSubscriptionId)) {
      await this.syncRecurringSubscription(input);
      return;
    }

    // DA1: mesmo um asaasSubscriptionId "não-real" (placeholder de adesão)
    // aponta para uma conta. Criar assinatura nova aqui embaixo, sem checar
    // isso, deixaria uma eventual assinatura legacy órfã e ativa — dupla
    // cobrança silenciosa (C28). Recriação é passo explícito do runbook (F5).
    if (master.asaasSubscriptionId && master.asaasSubscriptionAccount === "legacy") {
      throw new Error(
        `Master ${master.id} tem asaasSubscriptionId (${master.asaasSubscriptionId}) na conta legacy — ` +
          "criar uma assinatura nova aqui deixaria a legada órfã e ativa. Recriação é passo do " +
          "runbook de migração ([[30 — Migração de Conta (execução) — Backend]] F5), nunca automática."
      );
    }

    const ownerTz = master.timezone ?? DEFAULT_TZ;
    const nextDueDate =
      input.nextDueDateOverride != null
        ? formatDueDate(input.nextDueDateOverride, ownerTz)
        : formatIntimezone(new Date(), "yyyy-MM-dd", ownerTz);

    const cycle = normalizeAsaasCycle(master.subscriptionCycle);
    let customerId = await this.ensureCustomer(master);
    if (master.asaasCustomerAccount === "legacy") {
      // Achado cursor[bot] (PR #1137, P1, round 12): createAsaasSubscription
      // (abaixo) roda sempre na conta primary (DA1/DA5, comentário na
      // definição da função) — enviar o cus_ validado por ensureCustomer
      // acima quebra com "invalid customer" quando ele vive na legacy
      // (customer_id do Asaas é escopado por conta). Diferente do catch de
      // ensureCustomer (DA1: nunca recria por um GET que falhou), aqui o
      // cus_ legacy é válido — só não serve para esta chamada específica.
      // Mesmo padrão já usado em createOperatorCheckout (DA6): resolve um
      // par novo na primary via gateway antes do POST, sem tocar a legacy.
      console.info(
        `🔁 [ensureOrSyncRecurringSubscription] master ${master.id} tem customer legacy ` +
          `(${customerId}) — criando par novo na conta primary via gateway.`
      );
      customerId = await createAsaasCustomer(master);
      await billingRepository.updateAsaasCustomerId(master.id, customerId);
    }
    const description = input.reason || "Assinatura Corretor Studio";

    if (defaultBillingType === "CREDIT_CARD" && master.asaasSubscriptionId) {
      try {
        const currentSubscription = await this.getCurrentSubscription(master);
        const creditCardToken = currentSubscription.creditCard?.creditCardToken;
        if (creditCardToken) {
          const newSubscription = await createAsaasSubscription({
            customer: customerId,
            billingType: "CREDIT_CARD",
            value: roundCurrency(input.targetRecurringTotal),
            cycle,
            nextDueDate,
            description,
            externalReference: `manager-${master.id}-${Date.now()}`,
            creditCardToken,
          });

          await billingRepository.updateSubscriptionData(master.id, {
            asaasSubscriptionId: newSubscription.subscriptionId,
            subscriptionNextDueDate: new Date(newSubscription.data.nextDueDate),
            subscriptionCycle: newSubscription.data.cycle || cycle,
          });
          return;
        }
      } catch (error) {
        console.info(
          "[IncrementalBillingService][ensureOrSyncRecurringSubscription] Fallback para PIX:",
          error
        );
      }
    }

    const newSubscription = await createAsaasSubscription({
      customer: customerId,
      billingType: "PIX",
      value: roundCurrency(input.targetRecurringTotal),
      cycle,
      nextDueDate,
      description,
      externalReference: `manager-${master.id}-${Date.now()}`,
    });

    await billingRepository.updateSubscriptionData(master.id, {
      asaasSubscriptionId: newSubscription.subscriptionId,
      subscriptionNextDueDate: new Date(newSubscription.data.nextDueDate),
      subscriptionCycle: newSubscription.data.cycle || cycle,
    });
  }

  private async ensureCustomer(
    master: BillingOwnerProfile,
    override?: IncrementalChargeCustomerOverride
  ): Promise<string> {
    if (master.asaasCustomerId) {
      const account = master.asaasCustomerAccount;
      try {
        const client = createAsaasClient(account);
        await client.request(`${client.endpoints.customers}/${master.asaasCustomerId}`, {
          method: "GET",
        });
        return master.asaasCustomerId;
      } catch (error) {
        const statusCode = (error as { statusCode?: number } | null)?.statusCode;

        // DA1: recriar customer nunca é comportamento emergente de um catch —
        // é passo explícito do runbook de migração, com registro no ledger.
        // Vale para qualquer status (404 ou não) e qualquer conta: um GET que
        // falha em cus_ armazenado não significa "cadastro desatualizado".
        throw new Error(
          `Cliente Asaas ${master.asaasCustomerId} (conta ${account}) não pôde ser lido ` +
            `(statusCode=${statusCode ?? "desconhecido"}). Recriação de customer é passo explícito ` +
            "do runbook de migração ([[30 — Migração de Conta (execução) — Backend]]), nunca automática.",
          { cause: error }
        );
      }
    }

    const customerId = override
      ? await createAsaasCustomerFromOverride(master.id, override)
      : await createAsaasCustomer(master);

    await billingRepository.updateAsaasCustomerId(master.id, customerId);
    return customerId;
  }

  private async getCurrentSubscription(master: BillingOwnerProfile): Promise<AsaasSubscriptionDetails> {
    if (!master.asaasSubscriptionId) {
      throw new Error("Master não possui assinatura ativa configurada.");
    }

    return getAsaasSubscription(master.asaasSubscriptionId, master.asaasSubscriptionAccount);
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
    return formatIntimezone(nextDueDate, "yyyy-MM-dd", ownerTz);
  }

  async calculateProportionalAmount(
    masterId: string,
    addonType: "user" | "team"
  ): Promise<{ billingDelta: number; remainingMonths: number; totalCharge: number; maxInstallments: number }> {
    const projection = await this.projectBilling(masterId, {
      additionalUsers: addonType === "user" ? 1 : 0,
      additionalTeams: addonType === "team" ? 1 : 0,
    });
    const billingDelta = projection.billingDelta;

    const endDate = await billingRepository.getSubscriptionEndDate(masterId);
    const now = new Date();

    let remainingMonths = 1;
    if (endDate && !Number.isNaN(endDate.getTime())) {
      const monthsRemaining = Math.round(
        (endDate.getFullYear() - now.getFullYear()) * 12 + (endDate.getMonth() - now.getMonth())
      );
      remainingMonths = Math.max(1, monthsRemaining);
    }

    const totalCharge = roundCurrency(billingDelta * remainingMonths);

    return {
      billingDelta,
      remainingMonths,
      totalCharge,
      maxInstallments: remainingMonths,
    };
  }
}

export const incrementalBillingService = new IncrementalBillingService();
