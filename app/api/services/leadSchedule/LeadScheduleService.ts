import { randomUUID } from "node:crypto";
import { ActivityType, InviteDispatchStatus, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import type { IMeetingRepository } from "@/app/api/infra/data/repositories/meeting/IMeetingRepository";
import { meetingRepository } from "@/app/api/infra/data/repositories/meeting/MeetingRepository";
import type { IMeetingInvitationDispatcher } from "./invitationDispatch/IMeetingInvitationDispatcher";
import { meetingInvitationDispatcher } from "./invitationDispatch/MeetingInvitationDispatcher";
import type {
  GoogleCalendarLogEvent,
  InviteDispatchActivityEvent,
  InviteDispatchProvider,
  InviteDispatchPublicResult,
} from "./invitationDispatch/types";
import { emailService } from "@/lib/services/EmailService";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { teamAutomationDispatcherService } from "@/app/api/services/teamAutomation/TeamAutomationDispatcherService";
import { outboundEventPublisher } from "@/app/api/services/teamWebhook/OutboundEventPublisher";
import { Output } from "@/lib/output";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { validateMeetingLinkValue } from "@/lib/validations/meetingLink";
import { getScheduleShareExpiry } from "@/lib/schedule-share";
import type { ILeadScheduleService, CreateScheduleParams } from "./ILeadScheduleService";
import { buildUniqueEmails, resolveParticipantDispatchGroups } from "./participantDispatch";
import { resolveCloserCalendarTransfer } from "./resolveCloserCalendarTransfer";
import type { Attachment } from "resend";
import { formatIntimezone, resolveTimezone } from "@/lib/dates";
import { isGoogleConnectionActive } from "@/lib/google/connection";
import { buildStudioActivityData } from "@/lib/studio-feed-identity";

// SPEC 13, A-E3 — `InviteDispatchProvider`/`InviteDispatchPublicResult` agora
// vivem em `invitationDispatch/types.ts` (compartilhados com o despachante).
// `CalendarEventResult` idem — ver import de `IMeetingInvitationDispatcher`.

const STATUS_LABELS: Record<LeadStatus, string> = {
  new_opportunity: "Nova oportunidade",
  scheduled: "Agendado",
  no_show: "No Show",
  pricingRequest: "Cotação",
  future_sale: "Venda Futura",
  offerNegotiation: "Negociação",
  pending_documents: "Documentos pendentes",
  offerSubmission: "Proposta",
  dps_agreement: "DPS | Contrato",
  invoicePayment: "Boleto",
  disqualified: "Desqualificado",
  opportunityLost: "Perdido",
  operator_denied: "Negado operadora",
  contract_finalized: "Negócio fechado",
};

const LOG_PREFIX = "[LeadScheduleService]";
const NO_SHOW_SCHEDULE_CONFIRMATION_THRESHOLD = 3;

const formatMeetingDate = (date: Date, tz: string) => formatIntimezone(date, "dd/MM/yyyy HH:mm", tz);

// SPEC 13, A-E3 — `getErrorMessage`/`toUserFacingGoogleCalendarError`/
// `extractResendMessageId` mudaram para `invitationDispatch/MeetingInvitationDispatcher.ts`,
// único lugar que ainda os usa.

const buildInviteDispatchBody = ({
  provider,
  status,
  fallbackUsed,
  error,
}: {
  provider: InviteDispatchProvider;
  status: InviteDispatchStatus;
  fallbackUsed: boolean;
  error: string | null;
}) => {
  if (status === "sent_google") {
    return "Convite de agendamento enviado via Google Calendar.";
  }
  if (status === "sent_resend" && fallbackUsed) {
    return "Convite enviado por e-mail (Resend) após falha no Google Calendar.";
  }
  if (status === "sent_resend") {
    return "Convite enviado por e-mail (Resend).";
  }
  if (provider === "google") {
    return error
      ? `Falha ao disparar convite via Google Calendar. Motivo: ${error}`
      : "Falha ao disparar convite via Google Calendar.";
  }
  if (fallbackUsed) {
    return error
      ? `Falha ao enviar convite por e-mail (Resend) após falha no Google Calendar. Motivo: ${error}`
      : "Falha ao enviar convite por e-mail (Resend) após falha no Google Calendar.";
  }
  return error
    ? `Falha ao enviar convite por e-mail (Resend). Motivo: ${error}`
    : "Falha ao enviar convite por e-mail (Resend).";
};

const registerInviteDispatchActivity = async ({
  leadId,
  provider,
  status,
  fallbackUsed,
  attemptedAt,
  recipients,
  error,
  metadata,
}: {
  leadId: string;
  provider: InviteDispatchProvider;
  status: InviteDispatchStatus;
  fallbackUsed: boolean;
  attemptedAt: Date;
  recipients: string[];
  error: string | null;
  metadata: Prisma.InputJsonValue | null;
}) => {
  try {
    await prisma.leadActivity.create({
      data: {
        leadId,
        ...buildStudioActivityData({
          type: ActivityType.note,
          body: buildInviteDispatchBody({ provider, status, fallbackUsed, error }),
          payload: {
            kind: "schedule",
            action: "invite_dispatch",
            provider,
            status,
            fallbackUsed,
            attemptedAt: attemptedAt.toISOString(),
            recipients,
            error,
            metadata,
          },
        }),
      },
    });
  } catch (activityError) {
    console.warn(`${LOG_PREFIX} Não foi possível registrar atividade de disparo de convite:`, activityError);
  }
};

const buildAuthorActivityData = (
  authorAsStudio: boolean,
  createdByProfileId: string,
  input: {
    type: ActivityType;
    body: string;
    payload?: Prisma.InputJsonValue | Record<string, unknown> | null;
  }
): Prisma.LeadActivityUncheckedCreateWithoutLeadInput =>
  authorAsStudio
    ? buildStudioActivityData(input)
    : {
        type: input.type,
        body: input.body,
        payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        createdBy: createdByProfileId,
      };

export class LeadScheduleService implements ILeadScheduleService {
  // SPEC 13 (Agenda na Criação de Lead), A-E2 — DIP: depende da interface
  // `IMeetingRepository`, com o singleton concreto só como valor padrão do
  // parâmetro, para não quebrar `export const leadScheduleService = new
  // LeadScheduleService()` (6 call sites de produção usam esse singleton) e
  // ainda permitir injetar um dublê nos testes.
  constructor(
    private readonly meetingRepo: IMeetingRepository = meetingRepository,
    // SPEC 13, A-E3 — mesmo padrão do A-E2: DIP com o singleton concreto só
    // como valor padrão, para não quebrar os 6 call sites de produção.
    private readonly invitationDispatcher: IMeetingInvitationDispatcher = meetingInvitationDispatcher
  ) {}

  async createSchedule(params: CreateScheduleParams): Promise<Output> {
    const {
      leadId,
      leadName,
      leadEmail,
      leadStatus,
      leadManagerId,
      leadAssignedTo,
      leadAssigneeEmail,
      leadCurrentCloserId,
      leadMeetingLink,
      leadCode,
      closerId,
      teamId,
      meetingDate: meetingDateISO,
      meetingTitle,
      meetingNotes,
      meetingLink,
      meetingType,
      durationMinutes,
      extraGuests,
      createdByProfileId,
      transitionStatusToScheduled,
      confirmNoShowSchedule,
      authorAsStudio = false,
    } = params;

    const resolvedMeetingType = meetingType ?? "online";
    const isOnlineMeeting = resolvedMeetingType === "online";
    if (!meetingDateISO) {
      return new Output(false, [], ["Data da reunião é obrigatória."], null);
    }
    const meetingDate = new Date(meetingDateISO);
    const shouldLogCloserChange = closerId !== leadCurrentCloserId;

    const existingSchedule = await leadScheduleRepository.findLatestByLeadId(leadId);
    const scheduleId = existingSchedule?.id ?? randomUUID();
    const noShowCount = existingSchedule?.noShowCount ?? 0;
    const isReschedule = !!(existingSchedule?.googleEventId);

    if (
      leadStatus === LeadStatus.no_show &&
      noShowCount >= NO_SHOW_SCHEDULE_CONFIRMATION_THRESHOLD &&
      !confirmNoShowSchedule
    ) {
      return new Output(
        false,
        [],
        [
          `Este lead já teve no-show ${noShowCount} vezes. Confirme para continuar com o agendamento.`,
        ],
        {
          requiresNoShowConfirmation: true,
          noShowCount,
          threshold: NO_SHOW_SCHEDULE_CONFIRMATION_THRESHOLD,
        }
      );
    }

    const closerProfile = await prisma.profile.findUnique({
      where: { id: closerId },
      include: {
        googleConnection: {
          select: {
            accessToken: true,
            refreshToken: true,
            tokenExpiresAt: true,
            revokedAt: true,
            googleEmail: true,
          },
        },
      },
    });

    if (!closerProfile || !closerProfile.email) {
      return new Output(false, [], ["Closer não encontrado ou sem e-mail válido."], null);
    }

    if (!leadEmail?.trim()) {
      return new Output(
        false,
        [],
        ["Lead precisa de um email para agendar a reunião. Preencha o email do lead antes de agendar."],
        null
      );
    }

    const closerEmail = closerProfile.email.trim().toLowerCase();
    const resolvedMeetingTitle = meetingTitle || `Estudo Plano de Saúde: ${leadName}`;
    const participantDispatch = await resolveParticipantDispatchGroups({
      teamId,
      emails: [
        leadEmail,
        closerEmail,
        leadAssigneeEmail,
        ...(extraGuests ?? []),
      ],
    });
    const attendeeEmails = participantDispatch.all;
    const canUseGoogleCalendar = isGoogleConnectionActive(closerProfile.googleConnection);
    // When Google Calendar is available, ALL participants are added as attendees on the event
    // and Google handles delivery to every address (including external guests).
    // Resend is only used when Google is not connected.
    const googleRecipients = canUseGoogleCalendar ? attendeeEmails : [];
    const resendRecipients = canUseGoogleCalendar ? [] : attendeeEmails;
    const participantDispatchMetadata = {
      googleEligible: participantDispatch.googleEligible,
      resendRequired: participantDispatch.resendRequired,
      internalConnected: participantDispatch.internalConnected,
      internalDisconnected: participantDispatch.internalDisconnected,
      externalOrUnknown: participantDispatch.externalOrUnknown,
      googleRecipients,
      resendRecipients,
    };
    const manualLinkRequired = isOnlineMeeting && !canUseGoogleCalendar;
    // Achado da revisão final do PR de A-E1c (R13-8, mesma raiz no backoffice) —
    // o link não é usado fora de reunião online, então um valor herdado
    // (possivelmente `http:` legado) não pode travar o agendamento por
    // telefone/WhatsApp só por causa do esquema.
    const validatedMeetingLink = validateMeetingLinkValue(meetingLink, {
      required: manualLinkRequired,
      allowLegacyHttp:
        !isOnlineMeeting || (!!meetingLink && meetingLink === existingSchedule?.meetingLink),
    });

    if (!validatedMeetingLink.isValid) {
      if (manualLinkRequired && !meetingLink?.trim()) {
        return new Output(
          false,
          [],
          ["Closer sem Google conectado. Informe um link manual da reunião para continuar."],
          null
        );
      }

      return new Output(
        false,
        [],
        [validatedMeetingLink.error],
        null
      );
    }
    const normalizedMeetingLink = validatedMeetingLink.normalized;

    const calendarTransfer = resolveCloserCalendarTransfer({
      closerId,
      leadCurrentCloserId,
      existingGoogleEventId: existingSchedule?.googleEventId,
      existingMeetingLink: existingSchedule?.meetingLink,
      leadMeetingLink,
      requestMeetingLink: normalizedMeetingLink,
    });

    let schedulerLabel = "Usuário";
    try {
      const schedulerProfile = await prisma.profile.findUnique({
        where: { id: createdByProfileId },
        select: { fullName: true, email: true },
      });

      schedulerLabel = schedulerProfile?.fullName || schedulerProfile?.email || "Usuário";
    } catch (schedulerError) {
      console.warn(`${LOG_PREFIX} Não foi possível resolver o scheduler para logs e notificação:`, schedulerError);
    }

    const inviteDispatchLastAttemptAt = new Date();

    // SPEC 13 (Agenda na Criação de Lead), A-E3 — a leitura do perfil do
    // closer anterior (só relevante numa troca de closer com evento
    // existente no Google) é resolvida aqui, antes do despacho, e passada já
    // pronta para `IMeetingInvitationDispatcher`, que não lê banco (T-13.7).
    // Mesma condição de antes (`shouldTransferCalendarOwnership` +
    // `previousCloserId` + `previousEventId`); a única mudança é o MOMENTO da
    // leitura (antes do despacho, não só depois do upsert no Google ter
    // sucesso) — sem efeito no resultado, porque a estratégia só tenta
    // cancelar depois que o upsert novo já teve sucesso, igual antes.
    const shouldAttemptCalendarTransfer = Boolean(
      calendarTransfer.shouldTransferCalendarOwnership &&
        calendarTransfer.previousCloserId &&
        calendarTransfer.previousEventId
    );
    let previousOrganizerForTransfer: typeof closerProfile | null = null;
    if (shouldAttemptCalendarTransfer && calendarTransfer.previousCloserId) {
      const previousCloserProfile = await prisma.profile.findUnique({
        where: { id: calendarTransfer.previousCloserId },
        include: {
          googleConnection: {
            select: {
              accessToken: true,
              refreshToken: true,
              tokenExpiresAt: true,
              revokedAt: true,
              googleEmail: true,
            },
          },
        },
      });
      previousOrganizerForTransfer =
        previousCloserProfile && isGoogleConnectionActive(previousCloserProfile.googleConnection)
          ? previousCloserProfile
          : null;
    }

    const flushDispatchEvents = async (
      activityEvents: InviteDispatchActivityEvent[],
      googleCalendarLogEvents: GoogleCalendarLogEvent[]
    ) => {
      for (const event of activityEvents) {
        await registerInviteDispatchActivity({
          leadId,
          provider: event.provider,
          status: event.status,
          fallbackUsed: event.fallbackUsed,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: event.recipients,
          error: event.error,
          metadata: event.metadata,
        });
      }
      if (googleCalendarLogEvents.length > 0) {
        const { logGoogleCalendarDispatchesForRecipients } = await import(
          "@/lib/email/log-profile-email-dispatches"
        );
        for (const event of googleCalendarLogEvents) {
          await logGoogleCalendarDispatchesForRecipients({
            recipients: event.recipients,
            subject: event.subject,
            category: "schedule_invite",
            sourceType: "leads_schedule",
            sourceId: event.sourceId,
            success: event.success,
            ...(event.errorMessage !== undefined ? { errorMessage: event.errorMessage } : {}),
          });
        }
      }
    };

    const dispatchResult = await this.invitationDispatcher.dispatch({
      isOnlineMeeting,
      canUseGoogleCalendar,
      leadId,
      leadEmail,
      leadName,
      resolvedMeetingType,
      resolvedMeetingTitle,
      scheduleId,
      teamId,
      attendeeEmails,
      googleRecipients,
      resendRecipients,
      participantDispatchMetadata,
      normalizedMeetingLink,
      existingSchedule: existingSchedule ? { googleEventId: existingSchedule.googleEventId } : null,
      closerEmail,
      closerName: closerProfile.fullName || closerProfile.email,
      closerPhone: closerProfile.phone,
      timezone: closerProfile.timezone,
      googleCalendarEventInput: {
        organizer: closerProfile,
        lead: { id: leadId, name: leadName, email: leadEmail } as any,
        sdrEmail: leadAssigneeEmail,
        meetingDate,
        meetingNotes,
        meetingLink: calendarTransfer.meetingLinkForUpsert,
        extraGuests,
        existingEventId: calendarTransfer.existingEventIdForUpsert,
        durationMinutes,
        transfer: shouldAttemptCalendarTransfer
          ? {
              shouldTransfer: true,
              previousOrganizer: previousOrganizerForTransfer,
              previousEventId: calendarTransfer.previousEventId,
              previousCalendarId: existingSchedule?.googleCalendarId ?? "primary",
              leadId,
              previousCloserId: calendarTransfer.previousCloserId,
              newCloserId: closerId,
            }
          : undefined,
      },
    });

    await flushDispatchEvents(dispatchResult.activityEvents, dispatchResult.googleCalendarLogEvents);

    if (!dispatchResult.ok) {
      return new Output(false, [], [dispatchResult.errorMessage], null);
    }

    const {
      calendarResult,
      calendarSyncWarning,
      resolvedMeetingLink,
      inviteDispatchStatus,
      inviteDispatchProvider,
      inviteDispatchFallbackUsed,
      inviteDispatchLastError,
      inviteDispatchLastPayload,
    } = dispatchResult;

    // --- Persist schedule + update lead ---
    const refreshedPublicShareExpiresAt = existingSchedule?.publicShareTokenHash
      ? getScheduleShareExpiry(meetingDate)
      : undefined;

    // SPEC 13 (Agenda na Criação de Lead), A-E2 — a atividade de mudança de
    // status é montada aqui (a política de "quando" e o texto/label
    // continuam no service) e só passada pronta para o repositório inserir.
    const statusChangeActivity =
      transitionStatusToScheduled === true && leadStatus !== LeadStatus.scheduled
        ? (() => {
            const fromStatus = leadStatus as LeadStatus;
            const fromLabel = STATUS_LABELS[fromStatus] ?? fromStatus;
            const toLabel = STATUS_LABELS[LeadStatus.scheduled];
            return buildAuthorActivityData(authorAsStudio, createdByProfileId, {
              type: ActivityType.status_change,
              body: `Status alterado de ${fromLabel} para ${toLabel}`,
              payload: {
                from: fromStatus,
                to: LeadStatus.scheduled,
                fromLabel,
                toLabel,
              },
            });
          })()
        : null;

    const message = isReschedule
      ? "Agendamento atualizado com sucesso"
      : "Agendamento criado com sucesso";

    const persisted = await prisma.$transaction(async (tx) => {
      const { schedule, lead: updatedLead } = await this.meetingRepo.upsertMeetingWithLeadTransition(
        tx,
        {
          scheduleId,
          leadId,
          meetingDate,
          meetingTitle: resolvedMeetingTitle,
          meetingNotes,
          meetingLink: resolvedMeetingLink,
          meetingType: resolvedMeetingType,
          extraGuests,
          closerId,
          googleEventId: calendarResult?.eventId,
          googleCalendarId: calendarResult?.calendarId,
          inviteDispatchStatus,
          inviteDispatchFallbackUsed,
          inviteDispatchLastAttemptAt,
          inviteDispatchLastError,
          inviteDispatchLastPayload,
          publicShareExpiresAt: refreshedPublicShareExpiresAt,
          existingSchedule: existingSchedule
            ? {
                date: existingSchedule.date,
                extraGuests: existingSchedule.extraGuests,
                googleEventId: existingSchedule.googleEventId,
                googleCalendarId: existingSchedule.googleCalendarId,
                reminder30MinSentAt: existingSchedule.reminder30MinSentAt,
              }
            : null,
          transitionStatusToScheduled: transitionStatusToScheduled === true,
          statusChangeActivity,
        }
      );

      return { schedule, lead: updatedLead, message };
    });

    const scheduleWarnings: string[] = [];
    if (calendarSyncWarning) {
      scheduleWarnings.push(calendarSyncWarning);
    }
    if (inviteDispatchStatus !== "failed") {
      try {
        const scheduleAttachments = await this.buildLeadScheduleAttachments(leadId);
        const leadPhoneForNotify = (
          await prisma.lead.findUnique({
            where: { id: leadId },
            select: { phone: true },
          })
        )?.phone;
        await emailService.sendCloserScheduleNotificationEmail({
          to: closerEmail,
          teamId,
          closerName: closerProfile.fullName || closerProfile.email,
          leadName,
          meetingTitle: resolvedMeetingTitle,
          meetingDate,
          meetingLink: resolvedMeetingLink,
          meetingType: resolvedMeetingType,
          leadCode,
          leadPhone: leadPhoneForNotify ?? null,
          isReschedule,
          attendees: attendeeEmails,
          notes: meetingNotes ?? null,
          attachments: scheduleAttachments,
          timezone: closerProfile.timezone,
        });
      } catch (closerNotificationError) {
        const closerNotificationMessage =
          "Agendamento criado, mas o e-mail de confirmação ao closer não foi enviado.";
        scheduleWarnings.push(closerNotificationMessage);
        console.warn(`${LOG_PREFIX} Falha ao enviar notificação ao closer:`, closerNotificationError);
        try {
          await prisma.leadActivity.create({
            data: {
              leadId,
              ...buildStudioActivityData({
                type: ActivityType.note,
                body: closerNotificationMessage,
                payload: {
                  kind: "schedule",
                  action: "closer_notification_failed",
                  error:
                    closerNotificationError instanceof Error
                      ? closerNotificationError.message
                      : String(closerNotificationError),
                },
              }),
            },
          });
        } catch (activityError) {
          console.warn(`${LOG_PREFIX} Falha ao registrar atividade de erro do closer:`, activityError);
        }
      }
    }

    // --- Fire-and-forget: activity logs + platform notifications ---
    void (async () => {
      try {
        const actionLabel = isReschedule ? "Reagendamento feito por" : "Agendamento feito por";
        const participants = buildUniqueEmails([
          leadEmail,
          closerProfile.email,
          leadAssigneeEmail,
          ...(extraGuests ?? []),
        ]);
        const meetingTimezone = resolveTimezone(closerProfile.timezone);
        const participantLines = participants.map((email) => `• ${email}`);
        const bodyLines = [
          `${actionLabel} ${schedulerLabel} para ${formatMeetingDate(meetingDate, meetingTimezone)}.`,
        ];
        if (participantLines.length > 0) {
          bodyLines.push("Participantes:", ...participantLines);
        }
        await prisma.leadActivity.create({
          data: {
            leadId,
            ...buildAuthorActivityData(authorAsStudio, createdByProfileId, {
              type: ActivityType.note,
              body: bodyLines.join("\n"),
              payload: {
                kind: "schedule",
                meetingDate: meetingDate.toISOString(),
                meetingTitle: resolvedMeetingTitle,
                participants,
              },
            }),
          },
        });
      } catch (activityError) {
        console.warn(`${LOG_PREFIX} Não foi possível registrar atividade de agendamento:`, activityError);
      }

      // Closer change activity
      if (shouldLogCloserChange) {
        try {
          const closerLabel = closerProfile.fullName || closerProfile.email || "Closer";
          await prisma.leadActivity.create({
            data: {
              leadId,
              type: "note",
              body: `Closer alterado para ${closerLabel}`,
              payload: {
                previousCloserId: leadCurrentCloserId,
                closerId,
              },
              createdBy: createdByProfileId,
            },
          });
        } catch (activityError) {
          console.warn(`${LOG_PREFIX} Não foi possível registrar atividade de alteração de closer:`, activityError);
        }
      }

      // Platform notifications
      try {
        const candidateRecipientProfileIds = Array.from(
          new Set(
            [leadManagerId, leadAssignedTo, closerId]
              .filter((profileId): profileId is string => !!profileId)
              .filter((profileId) => profileId !== createdByProfileId)
          )
        );
        const teamRecipients = await prisma.teamMember.findMany({
          where: {
            teamId,
            profileId: { in: candidateRecipientProfileIds },
          },
          select: { profileId: true },
        });
        const recipientProfileIds = teamRecipients.map((member) => member.profileId);
        if (recipientProfileIds.length > 0) {
          await notificationService.createScheduleNotification({
            teamId,
            actorProfileId: createdByProfileId,
            actorName: schedulerLabel,
            leadId,
            leadCode: leadCode ?? null,
            leadName,
            meetingDate,
            recipientProfileIds,
            isReschedule,
          });
        }
      } catch (notificationError) {
        console.error(`${LOG_PREFIX} Erro ao criar notificações de agendamento:`, notificationError);
      }
    })().catch((err) => {
      console.error(`${LOG_PREFIX} Background dispatch error:`, err);
    });

    // --- Build response ---
    const successMessages = [persisted.message, ...scheduleWarnings];
    if (canUseGoogleCalendar && resendRecipients.length > 0) {
      successMessages.push(
        "Aviso: Participantes sem Google conectado receberam convite via e-mail (Resend)."
      );
    }

    const inviteDispatch: InviteDispatchPublicResult = {
      status: inviteDispatchStatus,
      provider: inviteDispatchProvider,
      fallbackUsed: inviteDispatchFallbackUsed,
      attemptedAt: inviteDispatchLastAttemptAt.toISOString(),
      error: inviteDispatchLastError,
    };

    teamAutomationDispatcherService
      .dispatch({
        type: "meeting_scheduled",
        teamId,
        leadId,
        data: {
          scheduleId: persisted.schedule.id,
          meetingDate: meetingDate.toISOString(),
        },
      })
      .catch(console.error);

    await outboundEventPublisher.publish({
      teamId,
      eventKey: "appointment_created",
      leadId,
      payload: {
        schedule: {
          id: persisted.schedule.id,
          meeting_date: meetingDate.toISOString(),
        },
      },
    }).catch((error) => {
            console.error("[OutboundEventPublisher] Falha ao enfileirar evento:", error);
          });

    return new Output(
      true,
      successMessages,
      [],
      {
        ...persisted.schedule,
        status: persisted.lead.status,
        inviteDispatch,
      }
    );
  }

  private async buildLeadScheduleAttachments(leadId: string): Promise<Attachment[]> {
    try {
      const leadAttachments = await prisma.leadAttachment.findMany({
        where: { leadId },
        select: {
          id: true,
          fileName: true,
          fileType: true,
          storagePath: true,
          fileUrl: true,
        },
        orderBy: { uploadedAt: "asc" },
      });

      if (leadAttachments.length === 0) {
        return [];
      }

      const supabaseAdmin = createSupabaseAdmin();
      const attachments: Attachment[] = [];

      for (const leadAttachment of leadAttachments) {
        try {
          let buffer: Buffer | null = null;

          const storagePath = leadAttachment.storagePath?.trim();
          if (supabaseAdmin && storagePath) {
            const { data, error } = await supabaseAdmin.storage
              .from(STORAGE_BUCKETS.LEAD_ATTACHMENTS)
              .download(storagePath);

            if (error) {
              console.error(`${LOG_PREFIX} Erro ao baixar anexo do storage para e-mail de agendamento:`, {
                leadId,
                attachmentId: leadAttachment.id,
                storagePath,
                error,
              });
            } else if (data) {
              buffer = Buffer.from(await data.arrayBuffer());
            }
          }

          if (!buffer && leadAttachment.fileUrl) {
            const response = await fetch(leadAttachment.fileUrl);
            if (!response.ok) {
              throw new Error(`Falha ao baixar arquivo via URL pública: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
          }

          if (!buffer) {
            continue;
          }

          attachments.push({
            filename: leadAttachment.fileName || `documento-${leadAttachment.id}`,
            content: buffer,
            ...(leadAttachment.fileType ? { contentType: leadAttachment.fileType } : {}),
          });
        } catch (error) {
          console.error(`${LOG_PREFIX} Erro ao preparar anexo de lead para e-mail de agendamento:`, {
            leadId,
            attachmentId: leadAttachment.id,
            error,
          });
        }
      }

      return attachments;
    } catch (error) {
      console.error(`${LOG_PREFIX} Erro ao listar anexos do lead para e-mail de agendamento:`, {
        leadId,
        error,
      });
      return [];
    }
  }
}

export const leadScheduleService = new LeadScheduleService();
