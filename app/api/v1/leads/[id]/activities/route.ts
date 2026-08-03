import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ActivityType } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { getTeamAccess, hasLeadActivityAccess } from "@/app/api/v1/utils/teamAccess";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { createTaskUseCase } from "@/app/api/useCases/task/CreateTaskUseCase";
import { invalidateLeadActivitiesCache, invalidateTeamTasksCache } from "@/lib/cache/invalidation";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import { outboundEventPublisher } from "@/app/api/services/teamWebhook/OutboundEventPublisher";

const mentionSchema = z.object({
  profileId: z.string().uuid("profileId deve ser um UUID válido"),
  label: z.string().min(1).max(120).optional(),
});

const baseActivitySchema = z.object({
  type: z.enum(["note", "call", "whatsapp", "email", "meeting", "visit", "missed"]),
  body: z.string().min(1, "Mensagem é obrigatória"),
  mentions: z.array(mentionSchema).max(30).optional(),
  outcome: z.string().max(50).optional(),
  duration: z.number().int().min(0).optional(),
  contactDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "contactDate deve ser yyyy-mm-dd").optional(),
  contactTime: z.string().regex(/^\d{2}:\d{2}$/, "contactTime deve ser hh:mm").optional(),
});

const taskActivitySchema = z.object({
  type: z.literal("task"),
  title: z.string().min(1, "Título da tarefa é obrigatório").max(200),
  taskType: z.enum(["call", "documentation", "email", "proposal", "whatsapp", "meeting", "other"], {
    error: "Tipo de tarefa inválido",
  }),
  body: z.string().min(1, "Descrição da tarefa é obrigatória"),
  isUrgent: z.boolean().optional().default(false),
  startAt: z.string().datetime({ offset: true }).optional().nullable(),
  endAt: z.string().datetime({ offset: true }).optional().nullable(),
  assigneeProfileIds: z.array(z.string().uuid()).min(1, "Ao menos um responsável é obrigatório").max(20),
});

const activitySchema = z.discriminatedUnion("type", [
  baseActivitySchema,
  taskActivitySchema,
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }
    if (!hasLeadActivityAccess(teamAccess.access.teamMember)) {
      const output = new Output(false, [], ["Acesso negado: função SDR ou CLOSER necessária para registrar atividades."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const { id: leadId } = await params;
    if (!leadId) {
      const output = new Output(false, [], ["ID do lead é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const body = await request.json();
    const validation = activitySchema.safeParse(body);
    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    if (validation.data.type === "task") {
      const data = validation.data;
      const result = await createTaskUseCase.execute({
        leadId,
        teamId: teamAccess.access.teamId,
        creatorProfileId: teamAccess.access.profileId,
        title: data.title,
        taskType: data.taskType,
        body: data.body,
        isUrgent: data.isUrgent,
        startAt: data.startAt ? new Date(data.startAt) : null,
        endAt: data.endAt ? new Date(data.endAt) : null,
        assigneeProfileIds: data.assigneeProfileIds,
      });

      if (!result.isValid) {
        const statusCode = result.errorMessages.some((m) => m.includes("não encontrado")) ? 404 : 400;
        return NextResponse.json(result, { status: statusCode });
      }

      invalidateLeadActivitiesCache({ leadId });
      invalidateTeamTasksCache({ teamId: teamAccess.access.teamId });
      return NextResponse.json(result, { status: 201 });
    }

    // Existing note/call/whatsapp/email handling
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, teamId: true, leadCode: true, name: true },
    });

    if (!lead || lead.teamId !== teamAccess.access.teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    const mentionCandidates = validation.data.mentions ?? [];
    const mentionProfileIds = Array.from(
      new Set(
        mentionCandidates
          .map((mention) => mention.profileId)
          .filter((profileId) => profileId !== teamAccess.access.profileId)
      )
    );

    let validMentionProfileIds: string[] = [];
    if (mentionProfileIds.length > 0) {
      const mentionMembers = await prisma.teamMember.findMany({
        where: {
          teamId: teamAccess.access.teamId,
          profileId: { in: mentionProfileIds },
        },
        select: { profileId: true },
      });
      validMentionProfileIds = mentionMembers.map((member) => member.profileId);
    }

    const mentionPayload = mentionCandidates
      .filter((mention) => validMentionProfileIds.includes(mention.profileId))
      .map((mention) => ({
        profileId: mention.profileId,
        label: mention.label ?? null,
      }));

    const baseData = validation.data;
    const activity = await (prisma.leadActivity as any).create({
      data: {
        leadId,
        type: baseData.type as ActivityType,
        body: baseData.body.trim(),
        ...(mentionPayload.length > 0
          ? {
              payload: {
                mentions: mentionPayload,
              },
            }
          : {}),
        ...("outcome" in baseData && baseData.outcome !== undefined
          ? { outcome: baseData.outcome }
          : {}),
        ...("duration" in baseData && baseData.duration !== undefined
          ? { duration: baseData.duration }
          : {}),
        ...("contactDate" in baseData && baseData.contactDate !== undefined
          ? { contactDate: new Date(baseData.contactDate) }
          : {}),
        ...("contactTime" in baseData && baseData.contactTime !== undefined
          ? { contactTime: baseData.contactTime }
          : {}),
        createdBy: teamAccess.access.profileId,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        reactions: {
          select: {
            emoji: true,
            emojiUnified: true,
            profileId: true,
          },
        },
      },
    });

    if (validMentionProfileIds.length > 0) {
      try {
        const actorName =
          activity.author?.fullName ||
          activity.author?.email ||
          "Usuário";
        await notificationService.createMentionNotifications({
          teamId: teamAccess.access.teamId,
          actorProfileId: teamAccess.access.profileId,
          actorName,
          leadId: lead.id,
          leadCode: lead.leadCode ?? null,
          leadName: lead.name,
          activityId: activity.id,
          body: baseData.body.trim(),
          recipientProfileIds: validMentionProfileIds,
        });
      } catch (notificationError) {
        console.error("[LeadActivitiesRoute][POST] Erro ao criar notificações de menção:", notificationError);
      }
    }

    await outboundEventPublisher
      .publish({
        teamId: teamAccess.access.teamId,
        eventKey: "activity_created",
        leadId: lead.id,
        payload: {
          lead: {
            id: lead.id,
            leadCode: lead.leadCode ?? null,
            name: lead.name,
          },
          activity: {
            id: activity.id,
            type: activity.type,
            body: baseData.body.trim(),
          },
        },
      })
      .catch((error) => {
        console.error("[LeadActivitiesRoute][POST] Falha ao enfileirar activity_created:", error);
      });

    const output = new Output(true, ["Atividade adicionada com sucesso"], [], activity);
    invalidateLeadActivitiesCache({ leadId });
    return NextResponse.json(output, { status: 201 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadActivitiesRoute][POST] Erro ao adicionar atividade:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
