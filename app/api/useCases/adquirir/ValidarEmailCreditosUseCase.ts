import { z } from "zod";
import { Output } from "@/lib/output";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { slackEmailCreditsService } from "@/app/api/services/slackEmailCredits/SlackEmailCreditsService";
import type { EmailCreditPlan } from "@/app/api/services/slackEmailCredits/ISlackEmailCreditsService";

export const ASAAS_CREDIT_URLS: Record<EmailCreditPlan, string> = {
  "25k": "https://www.asaas.com/c/7t6pqaxdfc0yyc65",
  "50k": "https://www.asaas.com/c/g8wl8a5xrn009icv",
};

const validarCreditosSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido"),
  plan: z.enum(["25k", "50k"]),
});

export type ValidarEmailCreditosInput = z.infer<typeof validarCreditosSchema>;

export interface IValidarEmailCreditosUseCase {
  execute(input: ValidarEmailCreditosInput): Promise<Output>;
}

export class ValidarEmailCreditosUseCase implements IValidarEmailCreditosUseCase {
  async execute(input: ValidarEmailCreditosInput): Promise<Output> {
    const parsed = validarCreditosSchema.safeParse(input);

    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message);
      return new Output(false, [], messages, null);
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const plan = parsed.data.plan as EmailCreditPlan;

    const profile = await profileRepository.findByEmail(normalizedEmail);

    if (!profile) {
      return new Output(
        false,
        [],
        ["E-mail não encontrado. Use o e-mail da sua conta no Corretor Studio."],
        null,
      );
    }

    const slackResult = await slackEmailCreditsService.notify({
      email: normalizedEmail,
      plan,
      profileId: profile.id,
    });

    if (!slackResult.success) {
      console.error("[ValidarEmailCreditosUseCase] Falha ao notificar Slack:", slackResult.error);
    }

    const checkoutUrl = ASAAS_CREDIT_URLS[plan];

    return new Output(true, [], [], { checkoutUrl, plan, email: normalizedEmail });
  }
}

export const validarEmailCreditosUseCase = new ValidarEmailCreditosUseCase();
