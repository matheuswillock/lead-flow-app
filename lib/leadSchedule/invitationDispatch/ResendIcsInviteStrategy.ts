import { emailService } from "@/lib/services/EmailService";
import type {
  IResendIcsInviteStrategy,
  ResendContactNotificationData,
  ResendDispatchResult,
  ResendParticipantInviteData,
} from "@/app/api/services/leadSchedule/invitationDispatch/IResendIcsInviteStrategy";

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E3 — adaptador concreto de
 * `IResendIcsInviteStrategy`. Vive em `lib/`, ao lado de `GoogleCalendarInviteStrategy`
 * — ver o comentário lá para o motivo (evita duplicar em código novo o
 * débito "Service importando Service" que `LeadScheduleService.ts` já
 * carrega, rastreado na DA9 da SPEC 13).
 *
 * Fino de propósito: não decide nada, só repassa para `emailService`.
 */
export class ResendIcsInviteStrategy implements IResendIcsInviteStrategy {
  async sendParticipantInvite(data: ResendParticipantInviteData): Promise<ResendDispatchResult> {
    return emailService.sendMeetingInviteEmail(data);
  }

  async sendContactNotification(
    data: ResendContactNotificationData
  ): Promise<ResendDispatchResult> {
    return emailService.sendMeetingContactNotificationEmail(data);
  }
}

export const resendIcsInviteStrategy = new ResendIcsInviteStrategy();
