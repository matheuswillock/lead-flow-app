import type { AsaasAccountId } from "@/lib/asaas";

export interface BillingOwnerProfile {
  id: string;
  fullName: string | null;
  email: string;
  cpfCnpj: string | null;
  phone: string | null;
  postalCode: string | null;
  address: string | null;
  addressNumber: string | null;
  neighborhood: string | null;
  complement: string | null;
  asaasCustomerId: string | null;
  asaasCustomerAccount: AsaasAccountId;
  asaasSubscriptionId: string | null;
  asaasSubscriptionAccount: AsaasAccountId;
  subscriptionStatus: string | null;
  subscriptionNextDueDate: Date | null;
  subscriptionCycle: string | null;
  hasPermanentSubscription: boolean;
  hasUnlimitedUsers: boolean;
  timezone: string | null;
}
