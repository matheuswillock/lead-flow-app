'use server';

import { EmailUnsubscribeUseCase } from '@/app/api/useCases/email/EmailUnsubscribeUseCase';
import type { EmailUnsubscribeScope } from '../context/EmailUnsubscribeTypes';

const emailUnsubscribeUseCase = new EmailUnsubscribeUseCase();

/**
 * Server Action para confirmação de descadastro de e-mail.
 *
 * Substitui a chamada client-side para /api/v1/email/public/unsubscribe.
 * O browser envia um POST opaco para /_next/action-<hash> — a rota
 * real nunca aparece no Network.
 */
export async function confirmUnsubscribeAction(
  token: string,
  scope: EmailUnsubscribeScope,
): Promise<{ success: boolean; errorMessage?: string }> {
  const output = await emailUnsubscribeUseCase.unsubscribe(token, scope);

  if (!output.isValid) {
    return {
      success: false,
      errorMessage: output.errorMessages[0] ?? 'Erro ao processar descadastro',
    };
  }

  return { success: true };
}
