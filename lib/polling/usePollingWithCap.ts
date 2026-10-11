"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPollingDelayMs, hasReachedPollingCap } from "./pollingSchedule";

interface UsePollingWithCapOptions<T> {
  /** Quando `false`, nenhum polling roda. */
  enabled: boolean;
  /** Busca um resultado. Erros MUST ser tratados dentro de `poll` — o hook não captura exceções. */
  poll: () => Promise<T>;
  /** Quando `true` para o resultado atual, o polling para (sucesso, erro definitivo ou status terminal). */
  isTerminal: (result: T) => boolean;
}

interface UsePollingWithCapResult {
  /** Teto de tentativas atingido sem status terminal — nunca spinner eterno (DA3). */
  capReached: boolean;
  /** Reinicia a contagem de tentativas e refaz o polling desde a tentativa 0 (imediata). */
  restart: () => void;
}

/**
 * Dono único do polling com backoff e teto (DA3 da SPEC 41): usado por
 * `operator-confirmed` e `checkout-return` para nunca prometer "atualização
 * automática" sem um mecanismo real por trás, e nunca girar para sempre.
 */
export function usePollingWithCap<T>({
  enabled,
  poll,
  isTerminal,
}: UsePollingWithCapOptions<T>): UsePollingWithCapResult {
  const [capReached, setCapReached] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const pollRef = useRef(poll);
  const isTerminalRef = useRef(isTerminal);
  pollRef.current = poll;
  isTerminalRef.current = isTerminal;

  useEffect(() => {
    if (!enabled) {
      setCapReached(false);
      return;
    }

    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const schedule = (attempt: number) => {
      if (hasReachedPollingCap(attempt)) {
        if (!cancelled) setCapReached(true);
        return;
      }

      const timeoutId = setTimeout(async () => {
        if (cancelled) return;
        const result = await pollRef.current();
        if (cancelled) return;
        if (isTerminalRef.current(result)) return;
        schedule(attempt + 1);
      }, getPollingDelayMs(attempt));
      timeouts.push(timeoutId);
    };

    setCapReached(false);
    schedule(0);

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [enabled, resetKey]);

  const restart = useCallback(() => {
    setResetKey((value) => value + 1);
  }, []);

  return { capReached, restart };
}
