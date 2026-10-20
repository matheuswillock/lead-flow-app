import { profileRepository } from '@/app/api/infra/data/repositories/profile/ProfileRepository';
import { passwordResetAuditService } from '@/app/api/services/passwordResetAudit/PasswordResetAuditService';
import { Output } from '@/lib/output';
import { getEmailService } from '@/lib/services/EmailService';
import { buildSetPasswordEmailAuthLink } from '@/lib/supabase/email-auth-link';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { getFullUrl } from '@/lib/utils/app-url';
import type {
  ForgotPasswordInput,
  IForgotPasswordUseCase,
} from './IForgotPasswordUseCase';

const SUCCESS_MESSAGE = 'Link enviado com sucesso para seu e-mail.';
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

type RateLimitState = {
  count: number;
  resetAt: number;
};

const forgotPasswordAttempts = new Map<string, RateLimitState>();
function getMaskedEmail(email: string): string {
  const [localPart, domain = '***'] = email.split('@');
  const maskedLocal = localPart.length <= 2
    ? `${localPart[0] ?? '*'}*`
    : `${localPart.slice(0, 2)}***`;
  return `${maskedLocal}@${domain}`;
}

function isValidEmail(email: string): boolean {
  const atIndex = email.indexOf('@')
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@')) return false
  const domain = email.slice(atIndex + 1)
  const dotIndex = domain.lastIndexOf('.')
  return dotIndex > 0 && dotIndex < domain.length - 1
}

function checkAndRegisterRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const current = forgotPasswordAttempts.get(ip);

  if (!current || now > current.resetAt) {
    forgotPasswordAttempts.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - 1 };
  }

  if (current.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 };
  }

  current.count += 1;
  forgotPasswordAttempts.set(ip, current);
  return { allowed: true, remaining: Math.max(RATE_LIMIT_MAX_ATTEMPTS - current.count, 0) };
}

export class ForgotPasswordUseCase implements IForgotPasswordUseCase {
  async execute(input: ForgotPasswordInput): Promise<Output> {
    const normalizedEmail = (input.email ?? '').trim().toLowerCase();
    const routeTag = '[ForgotPasswordUseCase]';

    const rateLimitResult = checkAndRegisterRateLimit(input.ip);
    if (!rateLimitResult.allowed) {
      console.info(`${routeTag} Rate limit atingido`, {
        originScreen: input.originScreen,
      });

      return new Output(true, [SUCCESS_MESSAGE], [], null);
    }

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      console.info(`${routeTag} Email ausente ou inválido`, {
        originScreen: input.originScreen,
      });
      return new Output(true, [SUCCESS_MESSAGE], [], null);
    }

    try {
      const user = await profileRepository.findByEmail(normalizedEmail);

      if (!user || !user.supabaseId) {
        console.info(`${routeTag} Conta não elegível para reset`, {
          email: getMaskedEmail(normalizedEmail),
          originScreen: input.originScreen,
        });
        return new Output(true, [SUCCESS_MESSAGE], [], null);
      }

      const supabase = createSupabaseAdmin();
      if (!supabase) {
        console.error(`${routeTag} Supabase admin indisponível`, {
          email: getMaskedEmail(normalizedEmail),
        });
        return new Output(true, [SUCCESS_MESSAGE], [], null);
      }

      const auditFlow = await passwordResetAuditService.createFlow({
        profileId: user.id,
        recipientEmail: user.email,
        ip: input.ip,
        userAgent: input.userAgent,
        originScreen: input.originScreen,
      });

      const redirectTo = getFullUrl('/set-password');
      let data: Awaited<ReturnType<typeof supabase.auth.admin.generateLink>>['data'];
      let error: Awaited<ReturnType<typeof supabase.auth.admin.generateLink>>['error'];
      try {
        const generated = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email: user.email,
          options: {
            redirectTo,
          },
        });
        data = generated.data;
        error = generated.error;
      } catch (generationError) {
        if (auditFlow) {
          await passwordResetAuditService.recordFailure(auditFlow.id, 'link_generation_failed');
        }
        throw generationError;
      }

      if (error || !data?.properties?.action_link) {
        console.error(`${routeTag} Falha ao gerar link`, {
          email: getMaskedEmail(normalizedEmail),
          error: error?.message,
        });
        if (auditFlow) {
          await passwordResetAuditService.recordFailure(auditFlow.id, 'link_generation_failed');
        }
        return new Output(true, [SUCCESS_MESSAGE], [], null);
      }

      if (auditFlow) {
        await passwordResetAuditService.recordLinkGenerated(auditFlow.id);
      }

      const emailService = getEmailService();
      const emailResult = await emailService.sendPasswordResetEmail(
        user.email,
        user.fullName || user.email,
         buildSetPasswordEmailAuthLink(data, 'recovery', auditFlow?.id),
        {
          profileId: user.id,
          sourceType: 'password_reset',
          sourceId: auditFlow?.id,
          recipientEmail: user.email,
        },
      );

      if (!emailResult.success) {
        console.error(`${routeTag} Falha no envio de email`, {
          email: getMaskedEmail(normalizedEmail),
          error: emailResult.error,
        });
        if (auditFlow) {
          const dispatchIds = 'dispatchIds' in emailResult ? emailResult.dispatchIds : undefined;
          await passwordResetAuditService.recordEmailFailed(auditFlow.id, dispatchIds?.[0] ?? null);
        }
        return new Output(true, [SUCCESS_MESSAGE], [], null);
      }

      if (auditFlow) {
        const dispatchIds = 'dispatchIds' in emailResult ? emailResult.dispatchIds : undefined;
        const emailId =
          typeof emailResult.data === 'object' &&
          emailResult.data !== null &&
          'data' in emailResult.data &&
          typeof emailResult.data.data === 'object' &&
          emailResult.data.data !== null &&
          'id' in emailResult.data.data &&
          typeof emailResult.data.data.id === 'string'
            ? emailResult.data.data.id
            : null;
        await passwordResetAuditService.recordEmailSent(auditFlow.id, {
          dispatchId: dispatchIds?.[0] ?? null,
          resendEmailId: emailId,
        });
      }

      console.info(`${routeTag} Solicitação processada com sucesso`, {
        email: getMaskedEmail(normalizedEmail),
        userAgent: input.userAgent,
        originScreen: input.originScreen,
      });

      return new Output(true, [SUCCESS_MESSAGE], [], null);
    } catch (error) {
      console.error(`${routeTag} Erro inesperado`, {
        email: getMaskedEmail(normalizedEmail),
        error,
      });

      return new Output(true, [SUCCESS_MESSAGE], [], null);
    }
  }
}
