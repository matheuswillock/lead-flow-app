import type { Output } from '@/lib/output';

export interface ForgotPasswordInput {
  email?: string;
  ip: string;
  userAgent: string;
  originScreen: string;
}

export interface IForgotPasswordUseCase {
  execute(input: ForgotPasswordInput): Promise<Output>;
}
