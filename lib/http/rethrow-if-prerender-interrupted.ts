const PRERENDER_INTERRUPTED_DIGEST = "NEXT_PRERENDER_INTERRUPTED";

function isPrerenderBailoutMessage(message: string): boolean {
  return (
    message.includes("needs to bail out of prerendering") ||
    message.includes("rejects when the prerender is complete") ||
    message.includes("During prerendering")
  );
}

export function isPrerenderInterruptedError(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    (error as { digest?: unknown }).digest === PRERENDER_INTERRUPTED_DIGEST
  ) {
    return true;
  }

  if (error instanceof Error && isPrerenderBailoutMessage(error.message)) {
    return true;
  }

  return false;
}

export function rethrowIfPrerenderInterrupted(error: unknown): void {
  if (isPrerenderInterruptedError(error)) {
    throw error;
  }
}
