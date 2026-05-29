"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useContacts, type ContactsHookReturn } from "./ContactsHook";

const ContactsContext = createContext<ContactsHookReturn | undefined>(undefined);

type ContactsProviderProps = {
  children: ReactNode
  supabaseId: string
}

export function ContactsProvider({ children, supabaseId }: ContactsProviderProps) {
  const value = useContacts(supabaseId);
  return (
    <ContactsContext.Provider value={value}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContactsContext(): ContactsHookReturn {
  const ctx = useContext(ContactsContext);
  if (!ctx) {
    throw new Error("useContactsContext deve ser usado dentro de ContactsProvider");
  }
  return ctx;
}
