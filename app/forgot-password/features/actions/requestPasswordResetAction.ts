'use server';

import { ForgotPasswordUseCase } from '@/app/api/useCases/auth/ForgotPasswordUseCase';
import { headers } from 'next/headers';

const forgotPasswordUseCase = new ForgotPasswordUseCase();

/**
 * Server Action para solicitação de reset de senha.
 *
 * Substitui a chamada client-side para /api/v1/auth/forgot-password.
 * O browser envia um POST opaco para /_next/action-<hash> — a rota
 * real de autenticação nunca aparece no Network.
 */
export async function requestPasswordResetAction(email: string): Promise<{
  success: boolean;
  errorMessage?: string;
}> {
  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown';
  const userAgent = headersList.get('user-agent') ?? 'unknown';

  const output = await forgotPasswordUseCase.execute({
    email: email.trim().toLowerCase(),
    ip,
    userAgent,
    originScreen: 'forgot-password',
  });

  if (!output.isValid) {
    return {
      success: false,
      errorMessage: output.errorMessages[0] ?? 'Falha ao processar solicitação',
    };
  }

  return { success: true };
}
