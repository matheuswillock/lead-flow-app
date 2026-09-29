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
  if (typeof value === "string") return redactText(value);
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
    const result = value.map((item) => sanitizeValue(item, activeObjects, depth + 1));
    activeObjects.delete(value);
    return result;
  }
  if (value instanceof Map) {
    return sanitizeValue(Object.fromEntries(value.entries()), activeObjects, depth + 1);
  }
  if (value instanceof Set) {
    return sanitizeValue(Array.from(value), activeObjects, depth + 1);
  }
  if (typeof value !== "object" || value === null) return value;
  if (activeObjects.has(value)) return "[circular]";
  activeObjects.add(value);
  const result = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? REDACTED : sanitizeValue(item, activeObjects, depth + 1),
    ]),
  );
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

function defaultWriter(line: string): void {
  if (typeof process !== "undefined" && process.stdout?.write) {
    process.stdout.write(`${line}\n`);
    return;
  }
  console.log(line);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
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

function writeLine(
  write: (line: string) => void,
  maxBytes: number,
  level: LogLevel,
  scope: string,
  base: LogFields,
  message: string,
  fields: LogFields,
): void {
  try {
    const entry = {
      ts: new Date().toISOString(),
      level,
      scope,
      msg: redactText(message),
      ...base,
      ...(sanitize(fields) as LogFields),
    };
    write(serializeEntry(entry, maxBytes));
  } catch {
    try {
      write(JSON.stringify({ level, scope: redactText(scope), msg: "log failed" }));
    } catch {
      // Observability must never break the request being observed.
    }
  }
}

function createLoggerWithContext(scope: string, write: (line: string) => void, maxBytes: number, base: LogFields): Logger {
  return {
    info: (message, fields = {}) => writeLine(write, maxBytes, "info", scope, base, message, fields),
    warn: (message, fields = {}) => writeLine(write, maxBytes, "warn", scope, base, message, fields),
    error: (message, fields = {}) => writeLine(write, maxBytes, "error", scope, base, message, fields),
    child: (fields) => createLoggerWithContext(scope, write, maxBytes, { ...base, ...(sanitize(fields) as LogFields) }),
  };
}

export function createLogger(scope: string, options: LoggerOptions = {}): Logger {
  const write = options.write ?? defaultWriter;
  const maxBytes = Math.max(256, options.maxBytes ?? DEFAULT_MAX_BYTES);
  return createLoggerWithContext(scope, write, maxBytes, {});
}
