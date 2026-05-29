"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useContatos, type ContatosHookReturn } from "./ContactsHook";

const ContactsContext = createContext<ContactsHookReturn | undefined>(undefined);

type ContactsProviderProps = {
  children: ReactNode
  supabaseId: string
}

export function ContactsProvider({ children, supabaseId }: ContactsProviderProps) {
  const value = useContatos(supabaseId);
  return (
    <ContactsContext.Provider value={value}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContatosContext(): ContatosHookReturn {
  const ctx = useContext(ContactsContext);
  if (!ctx) {
    throw new Error("useContatosContext deve ser usado dentro de ContactsProvider");
  }
  return ctx;
}
