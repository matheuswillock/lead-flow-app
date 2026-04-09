'use client';

import React, { createContext, useContext } from 'react';
import type { IForgotPasswordContext } from './ForgotPasswordTypes';
import { useForgotPasswordHook } from './ForgotPasswordHook';
import { forgotPasswordService } from '../services/ForgotPasswordService';

const ForgotPasswordContext = createContext<IForgotPasswordContext | undefined>(undefined);

interface IForgotPasswordProviderProps {
  children: React.ReactNode;
}

export function ForgotPasswordProvider({ children }: IForgotPasswordProviderProps) {
  const contextState = useForgotPasswordHook({
    service: forgotPasswordService,
  });

  return (
    <ForgotPasswordContext.Provider value={contextState}>
      {children}
    </ForgotPasswordContext.Provider>
  );
}

export function useForgotPasswordContext() {
  const context = useContext(ForgotPasswordContext);

  if (!context) {
    throw new Error('useForgotPasswordContext must be used within ForgotPasswordProvider');
  }

  return context;
}
