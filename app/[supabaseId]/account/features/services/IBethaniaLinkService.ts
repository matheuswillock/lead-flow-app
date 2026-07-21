export type BethaniaLinkStatus = {
  linked: boolean;
  normalizedPhone?: string;
  linkedAt?: string;
  userLinkId?: string;
  /** Canal WhatsApp da Bethânia ativo e conectado (Evolution). */
  botAvailable: boolean;
  botStatus: "pending" | "connected" | "disconnected" | "error" | "unavailable";
  /** Dígitos do WhatsApp da assistente (canal ou env), para deep link wa.me. */
  assistantPhone?: string | null;
};

export type BethaniaLinkInitiateResult = {
  challengeId: string;
  code: string;
  expiresAt: string;
  /** Telefone da Account que deve enviar VINCULAR no WhatsApp. */
  expectedPhone?: string;
};

export type BethaniaRequestContext = {
  supabaseId: string;
  teamId: string;
};

export interface IBethaniaLinkService {
  getStatus(context: BethaniaRequestContext): Promise<BethaniaLinkStatus>;
  initiate(context: BethaniaRequestContext): Promise<BethaniaLinkInitiateResult>;
  revoke(context: BethaniaRequestContext): Promise<void>;
  buildWhatsappChatLink(phoneDigits: string | null | undefined): string | null;
  buildWhatsappDeepLink(
    code: string,
    phoneDigits?: string | null
  ): string | null;
  buildLinkCommand(code: string): string;
  formatAssistantPhone(phoneDigits: string | null | undefined): string | null;
}
