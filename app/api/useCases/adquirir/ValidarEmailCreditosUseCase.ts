import { z } from "zod";
import type { EmailCreditPlan as PrismaEmailCreditPlan } from "@prisma/client";
import { Output } from "@/lib/output";
import { EmailCreditUseCase } from "@/app/api/useCases/email/EmailCreditUseCase";
import { slackEmailCreditsService } from "@/app/api/services/slackEmailCredits/SlackEmailCreditsService";
import type { ISlackEmailCreditsService } from "@/app/api/services/slackEmailCredits/ISlackEmailCreditsService";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";

type LandingCreditPlan = "25k" | "50k";

// 25k/50k da página pública correspondem aos planos canônicos de preço
// (R$ 375 e R$ 650 em lib/email/email-credit-plans.ts).
const BILLING_PLAN_BY_LANDING_PLAN: Record<LandingCreditPlan, PrismaEmailCreditPlan> = {
  "25k": "upgrade",
  "50k": "business",
};

const planSchema = z.enum(["25k", "50k"], { message: "Plano inválido" });

export type ValidarEmailCreditosInput = {
  plan: LandingCreditPlan;
  access: TeamAccess;
};

export interface IValidarEmailCreditosUseCase {
  execute(input: ValidarEmailCreditosInput): Promise<Output>;
}

export class ValidarEmailCreditosUseCase implements IValidarEmailCreditosUseCase {
  constructor(
    private readonly emailCredits: Pick<EmailCreditUseCase, "subscribe"> = new EmailCreditUseCase(),
    private readonly slack: ISlackEmailCreditsService = slackEmailCreditsService,
  ) {}

  async execute(input: ValidarEmailCreditosInput): Promise<Output> {
    const parsedPlan = planSchema.safeParse(input.plan);
    if (!parsedPlan.success) {
      return new Output(false, [], parsedPlan.error.issues.map((issue) => issue.message), null);
    }

    const plan = parsedPlan.data;
    const purchase = await this.emailCredits.subscribe(
      BILLING_PLAN_BY_LANDING_PLAN[plan],
      input.access,
      "PIX",
    );

    if (!purchase.isValid || !purchase.result) {
      return new Output(false, [], purchase.errorMessages, null);
    }

    await this.notifyInterest(input.access, plan);

    const { checkoutUrl } = purchase.result as { checkoutUrl: string };
    return new Output(true, [], [], { checkoutUrl, plan });
  }

  private async notifyInterest(access: TeamAccess, plan: LandingCreditPlan): Promise<void> {
    if (!access.profileEmail) return;

    const result = await this.slack.notify({
      email: access.profileEmail,
      plan,
      profileId: access.profileId,
    });

    if (!result.success) {
      console.error("[ValidarEmailCreditosUseCase] Falha ao notificar Slack:", result.error);
    }
  }
}

export const validarEmailCreditosUseCase = new ValidarEmailCreditosUseCase();
