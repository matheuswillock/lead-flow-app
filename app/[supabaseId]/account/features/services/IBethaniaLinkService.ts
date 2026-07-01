export type BethaniaLinkStatus = {
  linked: boolean;
  normalizedPhone?: string;
  linkedAt?: string;
  userLinkId?: string;
};

export type BethaniaLinkInitiateResult = {
  challengeId: string;
  code: string;
  expiresAt: string;
};

export type BethaniaRequestContext = {
  supabaseId: string;
  teamId: string;
};

export interface IBethaniaLinkService {
  getStatus(context: BethaniaRequestContext): Promise<BethaniaLinkStatus>;
  initiate(context: BethaniaRequestContext): Promise<BethaniaLinkInitiateResult>;
  revoke(context: BethaniaRequestContext): Promise<void>;
  buildWhatsappDeepLink(code: string): string | null;
  buildLinkCommand(code: string): string;
}
