export interface IForgotPasswordService {
  requestPasswordReset(email: string): Promise<void>;
}
