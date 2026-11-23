"use client";

import { useMemo } from "react";
import type { ClientQuoteResult, ClientQuoteSnapshot } from "./ClientQuoteTypes";

export type ClientQuoteViewModel = {
  snapshot: ClientQuoteSnapshot | null;
  message: string | null;
  vidas: number;
  geradoEmLabel: string;
};

/** Monta o que a tela mostra a partir do resultado do servidor. Sem efeitos: só deriva dados. */
export function useClientQuoteViewModel(result: ClientQuoteResult): ClientQuoteViewModel {
  return useMemo(() => {
    if (result.status !== "ok") {
      return { snapshot: null, message: result.message, vidas: 0, geradoEmLabel: "" };
    }
    const { snapshot } = result;
    return {
      snapshot,
      message: null,
      vidas: snapshot.lives.reduce((a, b) => a + b, 0),
      geradoEmLabel: new Date(snapshot.geradoEm).toLocaleDateString("pt-BR"),
    };
  }, [result]);
}
