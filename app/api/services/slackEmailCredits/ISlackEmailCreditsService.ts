export type EmailCreditPlan = "25k" | "50k";

export interface SlackEmailCreditsPayload {
  email: string;
  plan: EmailCreditPlan;
  profileId: string;
}

export interface ISlackEmailCreditsService {
  notify(payload: SlackEmailCreditsPayload): Promise<{ success: boolean; error?: string }>;
}
