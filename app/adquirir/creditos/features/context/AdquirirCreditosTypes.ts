export type CreditPlan = "25k" | "50k";

export interface AdquirirCreditosResult {
  checkoutUrl: string;
  plan: CreditPlan;
  email: string;
}

export interface AdquirirCreditosContextValue {
  selectedPlan: CreditPlan | null;
  email: string;
  open: boolean;
  loading: boolean;
  fieldError: string | null;
  handleOpen: (plan: CreditPlan) => void;
  handleOpenChange: (nextOpen: boolean) => void;
  handleEmailChange: (value: string) => void;
  handleConfirm: () => Promise<void>;
}