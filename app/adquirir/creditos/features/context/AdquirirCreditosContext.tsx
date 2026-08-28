"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message";
import { z } from "zod";
import type { IAdquirirCreditosService } from "../services/IAdquirirCreditosService";
import { AdquirirCreditosService } from "../services/AdquirirCreditosService";
import type {
  AdquirirCreditosContextValue,
  CreditPlan,
} from "./AdquirirCreditosTypes";

const emailSchema = z.string().trim().email("Informe um e-mail válido");

const AdquirirCreditosContext = createContext<AdquirirCreditosContextValue | null>(null);

export function AdquirirCreditosProvider({ children }: { children: ReactNode }) {
  const service = useMemo<IAdquirirCreditosService>(() => new AdquirirCreditosService(), []);
  const [selectedPlan, setSelectedPlan] = useState<CreditPlan | null>(null);
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const submitInFlight = useRef(false);

  const handleOpen = useCallback((plan: CreditPlan) => {
    setSelectedPlan(plan);
    setFieldError(null);
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setLoading(false);
      setFieldError(null);
    }
  }, []);

  const handleEmailChange = useCallback((value: string) => {
    setEmail(value);
    setFieldError(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedPlan || submitInFlight.current) return;

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Informe um e-mail válido");
      return;
    }

    submitInFlight.current = true;
    setFieldError(null);
    setLoading(true);

    try {
      const result = await service.validarCredito({
        email: parsed.data.trim().toLowerCase(),
        plan: selectedPlan,
      });
      toast.success("Redirecionando para o pagamento...");
      window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
      setOpen(false);
    } catch (error) {
      setFieldError(toUserToastMessage(error));
    } finally {
      setLoading(false);
      submitInFlight.current = false;
    }
  }, [email, selectedPlan, service]);

  return (
    <AdquirirCreditosContext.Provider
      value={{
        selectedPlan,
        email,
        open,
        loading,
        fieldError,
        handleOpen,
        handleOpenChange,
        handleEmailChange,
        handleConfirm,
      }}
    >
      {children}
    </AdquirirCreditosContext.Provider>
  );
}

export function useAdquirirCreditosContext(): AdquirirCreditosContextValue {
  const context = useContext(AdquirirCreditosContext);
  if (!context) {
    throw new Error("useAdquirirCreditosContext must be used within AdquirirCreditosProvider");
  }
  return context;
}