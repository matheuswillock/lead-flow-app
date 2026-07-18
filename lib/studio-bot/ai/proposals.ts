export const BETHANIA_AI_PROPOSAL_TTL_MS = 10 * 60 * 1000;

export function bethaniaAiProposalExpiry(now = new Date()): Date {
  return new Date(now.getTime() + BETHANIA_AI_PROPOSAL_TTL_MS);
}

export function isBethaniaAiProposalConfirmable(
  proposal: { status: string; expiresAt: Date },
  now = new Date()
): boolean {
  return proposal.status === "pending" && proposal.expiresAt.getTime() > now.getTime();
}
