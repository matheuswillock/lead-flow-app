export type CreditPlan = "25k" | "50k";

export interface AdquirirCreditosResult {
  checkoutUrl: string;
  plan: CreditPlan;
}

export interface AdquirirCreditosContextValue {
  pendingPlan: CreditPlan | null;
  handleActivate: (plan: CreditPlan) => Promise<void>;
}
