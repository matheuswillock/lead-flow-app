'use client';

import { useCallback, useState } from 'react';
import type {
  IForgotPasswordActions,
  IForgotPasswordState,
} from './ForgotPasswordTypes';
import type { IForgotPasswordService } from '../services/IForgotPasswordService';

interface UseForgotPasswordHookProps {
  service: IForgotPasswordService;
}

const initialState: IForgotPasswordState = {
  email: '',
  isLoading: false,
  error: null,
  success: false,
};

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function useForgotPasswordHook({
  service,
}: UseForgotPasswordHookProps): IForgotPasswordState & IForgotPasswordActions {
  const [state, setState] = useState<IForgotPasswordState>(initialState);

  const setEmail = useCallback((email: string) => {
    setState((prev) => ({ ...prev, email }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const resetSuccess = useCallback(() => {
    setState((prev) => ({ ...prev, success: false }));
  }, []);

  const submit = useCallback(async () => {
    const normalizedEmail = state.email.trim().toLowerCase();

    if (!normalizedEmail) {
      setState((prev) => ({ ...prev, error: 'Por favor, informe seu e-mail' }));
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setState((prev) => ({ ...prev, error: 'Por favor, informe um e-mail válido' }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      await service.requestPasswordReset(normalizedEmail);
    } catch (error) {
      console.error('[useForgotPasswordHook] Error requesting reset:', error);
    } finally {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        success: true,
        email: '',
      }));
    }
  }, [service, state.email]);

  return {
    ...state,
    setEmail,
    submit,
    clearError,
    resetSuccess,
  };
}
