function safeDivide(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}

export function openRate(opened: number, sent: number): number | null {
  return safeDivide(opened, sent)
}

export function finalScore(leads: number, sent: number): number | null {
  const rate = safeDivide(leads, sent)
  return rate === null ? null : rate * 1000
}

export function formCloseRate(completed: number, started: number): number | null {
  return safeDivide(completed, started)
}

export function startRate(started: number, viewed: number): number | null {
  return safeDivide(started, viewed)
}
