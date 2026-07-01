import type { Output } from "@/lib/output";

export interface IBackofficeBotAuthUseCase {
  requestCode(email: string, normalizedPhone: string): Promise<Output>;
  verifyCode(normalizedPhone: string, code: string): Promise<Output>;
  linkInitiate(profileId: string): Promise<Output>;
  linkStatus(profileId: string): Promise<Output>;
  revokeLink(profileId: string): Promise<Output>;
  getAuthStatus(normalizedPhone: string): Promise<Output>;
}
