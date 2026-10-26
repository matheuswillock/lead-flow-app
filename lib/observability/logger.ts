export type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

export type Logger = {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
};

type LoggerOptions = {
  write?: (line: string) => void;
  maxBytes?: number;
};

const REDACTED = "[redacted]";
const DEFAULT_MAX_BYTES = 16 * 1024;
const MAX_SANITIZE_DEPTH = 8;
const MAX_SANITIZE_ITEMS = 100;
const MAX_STRING_BYTES = 8 * 1024;
const textEncoder = new TextEncoder();

type RuntimeProcess = {
  env?: Record<string, string | undefined>;
  stdout?: { write(value: string): void };
};

function getRuntimeProcess(): RuntimeProcess | undefined {
  return (globalThis as typeof globalThis & { process?: RuntimeProcess }).process;
}
const SECRET_KEY_PATTERN = /token|secret|cookie|password|passwd|pwd|pass|authorization|api[_-]?key|access[_-]?key|service[_-]?role|database[_-]?url|connection[_-]?string/i;
const SECRET_VALUE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/=]+/gi, replacement: "Bearer [redacted]" },
  { pattern: /\bsk-[A-Za-z0-9\-_]+/g, replacement: "sk-[redacted]" },
  { pattern: /\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*\.[A-Za-z0-9\-_]*/g, replacement: "[redacted-jwt]" },
  { pattern: /(postgresql?):\/\/([^/\s:@]+:)([^/\s@]+)@/gi, replacement: "$1://$2[redacted]@" },
];

function redactText(value: string): string {
  return SECRET_VALUE_PATTERNS.reduce((result, { pattern, replacement }) => {
    pattern.lastIndex = 0;
    return result.replace(pattern, replacement);
  }, value);
}

function sanitizeValue(value: unknown, activeObjects: WeakSet<object>, depth: number): unknown {
  if (typeof value === "string") {
    const redacted = redactText(value);
    return textEncoder.encode(redacted).byteLength <= MAX_STRING_BYTES
      ? redacted
      : `${truncateToBytes(redacted, MAX_STRING_BYTES)}…[truncated]`;
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) {
    const error: LogFields = { name: value.name, message: sanitizeValue(value.message, activeObjects, depth + 1) };
    if (value.cause !== undefined) error.cause = sanitizeValue(value.cause, activeObjects, depth + 1);
    return error;
  }
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_SANITIZE_DEPTH) return "[max-depth]";
  if (Array.isArray(value)) {
    if (activeObjects.has(value)) return "[circular]";
    activeObjects.add(value);
    const result = value.slice(0, MAX_SANITIZE_ITEMS).map((item) => sanitizeValue(item, activeObjects, depth + 1));
    if (value.length > MAX_SANITIZE_ITEMS) result.push(`[${value.length - MAX_SANITIZE_ITEMS} items truncated]`);
    activeObjects.delete(value);
    return result;
  }
  if (value instanceof Map) {
    if (activeObjects.has(value)) return "[circular]";
    activeObjects.add(value);
    const result = sanitizeValue(Object.fromEntries(Array.from(value.entries()).slice(0, MAX_SANITIZE_ITEMS)), activeObjects, depth + 1);
    activeObjects.delete(value);
    return result;
  }
  if (value instanceof Set) {
    if (activeObjects.has(value)) return "[circular]";
    activeObjects.add(value);
    const result = sanitizeValue(Array.from(value).slice(0, MAX_SANITIZE_ITEMS), activeObjects, depth + 1);
    activeObjects.delete(value);
    return result;
  }
  if (typeof value !== "object" || value === null) return value;
  if (activeObjects.has(value)) return "[circular]";
  activeObjects.add(value);
  const entries = Object.entries(value);
  const result = Object.fromEntries(
    entries.slice(0, MAX_SANITIZE_ITEMS).map(([key, item]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? REDACTED : sanitizeValue(item, activeObjects, depth + 1),
    ]),
  );
  if (entries.length > MAX_SANITIZE_ITEMS) result.__truncated = `[${entries.length - MAX_SANITIZE_ITEMS} fields truncated]`;
  activeObjects.delete(value);
  return result;
}

/** Converts arbitrary log data into a safe, JSON-compatible value. */
export function sanitize(value: unknown): unknown {
  try {
    return sanitizeValue(value, new WeakSet<object>(), 0);
  } catch {
    return REDACTED;
  }
}

const nativeConsole = globalThis.console;

function defaultWriter(line: string): void {
  const runtimeProcess = getRuntimeProcess();
  if (runtimeProcess?.stdout?.write) {
    runtimeProcess.stdout.write(`${line}\n`);
    return;
  }
  nativeConsole.info.call(nativeConsole, line);
}

export function hasNodeStdout(): boolean {
  return Boolean(getRuntimeProcess()?.stdout?.write);
}

function byteLength(value: string): number {
  return textEncoder.encode(value).byteLength;
}

function truncateToBytes(value: string, maxBytes: number): string {
  if (byteLength(value) <= maxBytes) return value;
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (byteLength(value.slice(0, middle)) <= maxBytes) low = middle;
    else high = middle - 1;
  }
  return value.slice(0, low);
}

function serializeEntry(entry: LogFields, maxBytes: number): string {
  const serialized = JSON.stringify(entry);
  if (byteLength(serialized) <= maxBytes) return serialized;

  const compactEntry = {
    ts: entry.ts,
    level: entry.level,
    scope: entry.scope,
    msg: "",
    truncated: true,
  };
  const suffix = JSON.stringify({ ...compactEntry, msg: "" });
  const availableBytes = Math.max(0, maxBytes - byteLength(suffix) + 2);
  compactEntry.msg = truncateToBytes(String(entry.msg), availableBytes);
  const compact = JSON.stringify(compactEntry);
  return byteLength(compact) <= maxBytes ? compact : JSON.stringify({ level: entry.level, msg: "log truncated" });
}

type WriteLineOptions = {
  write: (line: string) => void;
  maxBytes: number;
  level: LogLevel;
  scope: string;
  base: LogFields;
  message: string;
  fields: LogFields;
};

function writeLine(options: WriteLineOptions): void {
  try {
    const entry = {
      ts: new Date().toISOString(),
      ...getOperationalMetadata(),
      level: options.level,
      scope: options.scope,
      msg: redactText(options.message),
      ...options.base,
      ...(sanitize(options.fields) as LogFields),
    };
    options.write(serializeEntry(entry, options.maxBytes));
  } catch {
    try {
      options.write(JSON.stringify({ level: options.level, scope: redactText(options.scope), msg: "log failed" }));
    } catch {
      // Observability must never break the request being observed.
    }
  }
}

function getOperationalMetadata(): LogFields {
  const environmentVariables = getRuntimeProcess()?.env ?? {};
  const environment = environmentVariables.VERCEL_ENV ?? environmentVariables.APP_ENV ?? environmentVariables.NODE_ENV;
  const runtime = environmentVariables.NEXT_RUNTIME;
  const deployment = environmentVariables.VERCEL_DEPLOYMENT_ID ?? environmentVariables.VERCEL_GIT_COMMIT_SHA;
  return {
    ...(runtime ? { runtime } : {}),
    ...(environment ? { environment } : {}),
    ...(deployment ? { deployment } : {}),
  };
}

function createLoggerWithContext(scope: string, write: (line: string) => void, maxBytes: number, base: LogFields): Logger {
  return {
    info: (message, fields = {}) => writeLine({ write, maxBytes, level: "info", scope, base, message, fields }),
    warn: (message, fields = {}) => writeLine({ write, maxBytes, level: "warn", scope, base, message, fields }),
    error: (message, fields = {}) => writeLine({ write, maxBytes, level: "error", scope, base, message, fields }),
    child: (fields) => createLoggerWithContext(scope, write, maxBytes, { ...base, ...(sanitize(fields) as LogFields) }),
  };
}

export function createLogger(scope: string, options: LoggerOptions = {}): Logger {
  const write = options.write ?? defaultWriter;
  const maxBytes = Math.max(256, options.maxBytes ?? DEFAULT_MAX_BYTES);
  return createLoggerWithContext(scope, write, maxBytes, {});
}
