export interface IForgotPasswordState {
  email: string;
  isLoading: boolean;
  error: string | null;
  success: boolean;
}

export interface IForgotPasswordActions {
  setEmail: (email: string) => void;
  submit: () => Promise<void>;
  clearError: () => void;
  resetSuccess: () => void;
}

export interface IForgotPasswordContext
  extends IForgotPasswordState,
    IForgotPasswordActions {}
