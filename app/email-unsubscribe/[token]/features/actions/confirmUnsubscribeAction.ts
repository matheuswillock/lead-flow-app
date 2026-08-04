'use server';

import { EmailUnsubscribeUseCase } from '@/app/api/useCases/email/EmailUnsubscribeUseCase';
import {
  checkAndRegisterUnsubscribeRateLimit,
  UNSUBSCRIBE_RATE_LIMIT_MESSAGE,
} from '@/lib/email/unsubscribe-rate-limit';
import { headers } from 'next/headers';
import type { EmailUnsubscribeScope } from '../context/EmailUnsubscribeTypes';

const emailUnsubscribeUseCase = new EmailUnsubscribeUseCase();

/**
 * Server Action para confirmação de descadastro de e-mail.
 *
 * Substitui a chamada client-side para /api/v1/email/public/unsubscribe.
 * O browser envia um POST opaco para /_next/action-<hash> — a rota real nunca
 * aparece no Network. Mantém o mesmo rate limiting do route handler original
 * (5 tentativas por IP por hora).
 */
export async function confirmUnsubscribeAction(
  token: string,
  scope: EmailUnsubscribeScope,
): Promise<{ success: boolean; errorMessage?: string }> {
  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown';

  const rateLimit = checkAndRegisterUnsubscribeRateLimit(ip);
  if (!rateLimit.allowed) {
    return { success: false, errorMessage: UNSUBSCRIBE_RATE_LIMIT_MESSAGE };
  }

  const output = await emailUnsubscribeUseCase.unsubscribe(token, scope);

  if (!output.isValid) {
    return {
      success: false,
      errorMessage: output.errorMessages[0] ?? 'Erro ao processar descadastro',
    };
  }

  return { success: true };
}
