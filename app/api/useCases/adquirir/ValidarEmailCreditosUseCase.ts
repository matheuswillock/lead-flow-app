import { z } from "zod";
import { Output } from "@/lib/output";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { slackEmailCreditsService } from "@/app/api/services/slackEmailCredits/SlackEmailCreditsService";
import { getAsaasCheckoutBaseUrl } from "@/lib/asaas";
import type { EmailCreditPlan } from "@/app/api/services/slackEmailCredits/ISlackEmailCreditsService";

// DA3/E1 de [[40 — Checkout, Adesões e Add-ons — Backend]] (C17): o ID do
// checkout hospedado pertence à conta Asaas onde foi criado — nunca literal
// de código. Vem de env validada, sem fallback: ausência é Output inválido,
// não um ID legado silenciosamente reusado.
const ASAAS_CREDIT_CHECKOUT_ENV_KEYS: Record<EmailCreditPlan, string> = {
  "25k": "ASAAS_CREDIT_CHECKOUT_ID_25K",
  "50k": "ASAAS_CREDIT_CHECKOUT_ID_50K",
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

    const checkoutEnvKey = ASAAS_CREDIT_CHECKOUT_ENV_KEYS[plan];
    const checkoutId = process.env[checkoutEnvKey];

    if (!checkoutId) {
      console.error(
        `[ValidarEmailCreditosUseCase] Checkout hospedado não configurado — env ${checkoutEnvKey} ausente.`
      );
      return new Output(
        false,
        [],
        ["Checkout de créditos temporariamente indisponível. Tente novamente em instantes."],
        null,
      );
    }

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

    const checkoutUrl = `${getAsaasCheckoutBaseUrl()}/c/${checkoutId}`;

    return new Output(true, [], [], { checkoutUrl, plan, email: normalizedEmail });
  }
}

export const validarEmailCreditosUseCase = new ValidarEmailCreditosUseCase();
