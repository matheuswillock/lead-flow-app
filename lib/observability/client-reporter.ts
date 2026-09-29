"use client";

import { parseClientEvent } from "./client-events";

const ENDPOINT = "/api/v1/observability/client-events";
let installed = false;

function report(level: "warn" | "error", error: unknown): void {
  const event = parseClientEvent({
    level,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    route: window.location.pathname,
  });
  if (!event) return;

  const body = JSON.stringify(event);
  try {
    if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
  } catch {
    // Fall through to fetch for browsers where sendBeacon is unavailable.
  }
  void fetch(ENDPOINT, {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
    keepalive: true,
  }).catch(() => undefined);
}

export function installClientErrorReporter(): () => void {
  if (installed || typeof window === "undefined") return () => undefined;
  installed = true;
  const onError = (event: ErrorEvent) => report("error", event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => report("error", event.reason);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    installed = false;
  };
}
