import { profileRepository } from '@/app/api/infra/data/repositories/profile/ProfileRepository';
import { Output } from '@/lib/output';
import { getEmailService } from '@/lib/services/EmailService';
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
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
        ip: input.ip,
        originScreen: input.originScreen,
      });

      return new Output(true, [SUCCESS_MESSAGE], [], null);
    }

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      console.info(`${routeTag} Email ausente ou inválido`, {
        ip: input.ip,
        originScreen: input.originScreen,
      });
      return new Output(true, [SUCCESS_MESSAGE], [], null);
    }

    try {
      const user = await profileRepository.findByEmail(normalizedEmail);

      if (!user || !user.supabaseId) {
        console.info(`${routeTag} Conta não elegível para reset`, {
          email: getMaskedEmail(normalizedEmail),
          ip: input.ip,
          originScreen: input.originScreen,
        });
        return new Output(true, [SUCCESS_MESSAGE], [], null);
      }

      const supabase = createSupabaseAdmin();
      if (!supabase) {
        console.error(`${routeTag} Supabase admin indisponível`, {
          email: getMaskedEmail(normalizedEmail),
          ip: input.ip,
        });
        return new Output(true, [SUCCESS_MESSAGE], [], null);
      }

      const redirectTo = getFullUrl('/set-password');
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: user.email,
        options: {
          redirectTo,
        },
      });

      if (error || !data?.properties?.action_link) {
        console.error(`${routeTag} Falha ao gerar link`, {
          email: getMaskedEmail(normalizedEmail),
          ip: input.ip,
          error: error?.message,
        });
        return new Output(true, [SUCCESS_MESSAGE], [], null);
      }

      const emailService = getEmailService();
      const emailResult = await emailService.sendPasswordResetEmail(
        user.email,
        user.fullName || user.email,
        data.properties.action_link,
      );

      if (!emailResult.success) {
        console.error(`${routeTag} Falha no envio de email`, {
          email: getMaskedEmail(normalizedEmail),
          ip: input.ip,
          error: emailResult.error,
        });
        return new Output(true, [SUCCESS_MESSAGE], [], null);
      }

      console.info(`${routeTag} Solicitação processada com sucesso`, {
        email: getMaskedEmail(normalizedEmail),
        ip: input.ip,
        userAgent: input.userAgent,
        originScreen: input.originScreen,
        emailId: emailResult.data,
      });

      return new Output(true, [SUCCESS_MESSAGE], [], null);
    } catch (error) {
      console.error(`${routeTag} Erro inesperado`, {
        email: getMaskedEmail(normalizedEmail),
        ip: input.ip,
        error,
      });

      return new Output(true, [SUCCESS_MESSAGE], [], null);
    }
  }
}
