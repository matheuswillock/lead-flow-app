/**
 * Kill-switch do Realtime no modo db-only.
 *
 * O WAL do Postgres local não é o do projeto remoto. Assinar o Realtime
 * remoto com dados locais geraria reconexão silenciosa e eventos errados.
 * Hooks devem early-return antes de `.channel()`.
 */

export function isRealtimeDisabled(): boolean {
  return process.env.NEXT_PUBLIC_REALTIME_DISABLED === "true";
}

let loggedRealtimeDisabled = false;

export function logRealtimeDisabledOnce(): void {
  if (loggedRealtimeDisabled) return;
  loggedRealtimeDisabled = true;
  console.info(
    "[realtime] Desligado (NEXT_PUBLIC_REALTIME_DISABLED). Eventos do Postgres local não chegam. Use `bun dev -- --hybrid` para tempo real.",
  );
}

export function shouldSkipRealtimeSubscribe(): boolean {
  if (!isRealtimeDisabled()) return false;
  logRealtimeDisabledOnce();
  return true;
}

/** Só para testes — reseta o log único. */
export function resetRealtimeDisabledLogForTests(): void {
  loggedRealtimeDisabled = false;
}
