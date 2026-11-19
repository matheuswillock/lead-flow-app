import type { SheetPlan } from "@/components/plan-simulator/PlanSheet";

/** Snapshot congelado no envio: o cliente vê exatamente o que foi enviado. */
export type ClientQuotePlan = SheetPlan & { total: number };

export type ClientQuoteSnapshot = {
  nome: string;
  geradoEm: string;
  uf: string;
  lives: number[];
  filters: {
    acomodacoes: string[];
    coparticipacoes: string[];
    contratacoes: string[];
    hospitalIds: number[];
    mei: boolean;
    valorMin: number | null;
    valorMax: number | null;
  };
  plans: ClientQuotePlan[];
};

export type ClientQuoteResult =
  | { status: "ok"; snapshot: ClientQuoteSnapshot }
  | { status: "invalid" | "expired"; message: string };
