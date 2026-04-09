import type { Output } from "@/lib/output";

export type GoogleConnectionNotificationInput = {
  supabaseId: string;
  profileId: string;
  activeTeamId: string | null;
  googleEmail: string | null;
  previousGoogleEmail?: string | null;
};

export interface IGoogleConnectionUseCase {
  notifyGoogleConnected(input: GoogleConnectionNotificationInput): Promise<Output>;
  notifyGoogleDisconnected(input: GoogleConnectionNotificationInput): Promise<Output>;
}
