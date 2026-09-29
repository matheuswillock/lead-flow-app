import { createLogger } from "./logger";

type ConsoleLevel = "info" | "warn" | "error";

type ConsoleBridgeOptions = {
  write?: (line: string) => void;
};

const INSTALLATION_KEY = Symbol.for("lead-flow.structured-console-bridge");
type ConsoleState = { originals: Record<ConsoleLevel, typeof console.info> };

function getMessageAndFields(args: unknown[]): { scope: string; message: string; fields: Record<string, unknown> } {
  const first = args[0];
  if (typeof first === "string") {
    const match = /^\[([^\]]+)\]\s*(.*)$/.exec(first);
    const scope = match?.[1] ?? "legacy-console";
    const message = match?.[2] || first;
    return {
      scope,
      message,
      ...(args.length > 1 ? { fields: { details: args.slice(1) } } : { fields: {} }),
    };
  }

  return {
    scope: "legacy-console",
    message: "console event",
    fields: { details: args },
  };
}

export function installStructuredConsoleBridge(options: ConsoleBridgeOptions = {}): () => void {
  const globalState = globalThis as typeof globalThis & Record<symbol, ConsoleState | undefined>;
  if (globalState[INSTALLATION_KEY]) return () => undefined;

  const originals = {
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  (Object.keys({ info: true, warn: true, error: true }) as ConsoleLevel[]).forEach((level) => {
    console[level] = (...args: unknown[]) => {
      const { scope, message, fields } = getMessageAndFields(args);
      createLogger(scope, options).child({ source: "legacy-console" })[level](message, fields);
    };
  });

  globalState[INSTALLATION_KEY] = { originals };
  return () => {
    const state = globalState[INSTALLATION_KEY];
    if (!state) return;
    console.info = state.originals.info;
    console.warn = state.originals.warn;
    console.error = state.originals.error;
    delete globalState[INSTALLATION_KEY];
  };
}
