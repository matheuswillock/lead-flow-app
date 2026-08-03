import type { IForgotPasswordService } from './IForgotPasswordService';
import { API_CLIENT_BASE } from "@/lib/route-map";

export class ForgotPasswordService implements IForgotPasswordService {
  async requestPasswordReset(email: string): Promise<void> {
    const response = await fetch(`${API_CLIENT_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-origin-screen': 'forgot-password',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new Error('Falha ao processar solicitação');
    }
  }
}

export const forgotPasswordService = new ForgotPasswordService();
