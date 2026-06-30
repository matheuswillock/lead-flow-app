import { Output } from "@/lib/output";

import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";

import { studioBotActionRepository } from "@/app/api/infra/data/repositories/backofficeBot/StudioBotActionRepository";

import { botPolicyService, type BotPolicyAction } from "@/app/api/services/backofficeBot/BotPolicyService";

import { leadScheduleService } from "@/app/api/services/leadSchedule/LeadScheduleService";

import { leadAttachmentService } from "@/app/api/services/LeadAttachment/LeadAttachmentService";

import { createTaskUseCase } from "@/app/api/useCases/task/CreateTaskUseCase";

import { listTasksUseCase } from "@/app/api/useCases/task/ListTasksUseCase";

import { hasLeadAccess } from "@/app/api/v1/utils/teamAccess";

import { resolveStudioBotTeamAccess } from "@/lib/studio-bot/team-access";

import type { IBackofficeBotActionUseCase } from "./IBackofficeBotActionUseCase";



const ACTION_POLICY_MAP: Record<string, BotPolicyAction> = {

  list_leads: "view_lead_list",

  lead_detail: "view_lead_detail",

  agenda_today: "view_lead_list",

  list_tasks: "view_lead_list",

  add_note: "add_note",

  upload_attachment: "upload_attachment",

  schedule_meeting: "schedule_meeting",

  cancel_meeting: "cancel_meeting",

  create_task: "create_task",

  search_lead: "view_lead_list",

  team_digest: "view_team_digest",

};



const READ_ACTIONS = new Set([

  "list_leads",

  "lead_detail",

  "agenda_today",

  "list_tasks",

  "search_lead",

  "team_digest",

]);



export class BackofficeBotActionUseCase implements IBackofficeBotActionUseCase {

  async executeAction(

    action: string,

    input: {

      userLinkId: string;

      teamId?: string | null;

      params?: Record<string, unknown>;

      flowId?: string | null;

    }

  ): Promise<Output> {

    try {

      const policyAction = ACTION_POLICY_MAP[action];

      if (!policyAction) {

        return new Output(false, [], ["Ação não suportada"], { errorCode: "ACTION_NOT_FOUND" });

      }



      const link = await backofficeBotRepository.findUserLinkById(input.userLinkId);

      if (!link?.isActive) {

        return new Output(false, [], ["Número não vinculado"], { errorCode: "AUTH_NOT_LINKED" });

      }



      const access = await resolveStudioBotTeamAccess(link.profileId, input.teamId);

      if (!access) {

        return new Output(false, [], ["Acesso inválido para este time"], { errorCode: "AUTH_NOT_LINKED" });

      }



      if (!hasLeadAccess(access.teamMember) && !READ_ACTIONS.has(action)) {

        return new Output(false, [], ["Você não tem permissão para esta ação"], {

          errorCode: "PERMISSION_DENIED",

        });

      }



      const leadId = typeof input.params?.leadId === "string" ? input.params.leadId : undefined;

      const leadRow = leadId

        ? await studioBotActionRepository.findLeadPolicyContext(leadId, access.teamId)

        : undefined;



      if (leadId && !leadRow) {

        return new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], {

          errorCode: "LEAD_NOT_FOUND",

        });

      }



      const leadContext = leadRow

        ? { assignedToId: leadRow.assignedTo, closerId: leadRow.closerId }

        : undefined;



      if (!botPolicyService.assertAction(policyAction, { access, lead: leadContext })) {

        return new Output(false, [], ["Você não tem permissão para esta ação"], {

          errorCode: "PERMISSION_DENIED",

        });

      }



      const params = input.params ?? {};



      switch (action) {

        case "list_leads":

        case "search_lead": {

          const search =

            typeof params.search === "string"

              ? params.search

              : typeof params.query === "string"

                ? params.query

                : undefined;

          const leads = await studioBotActionRepository.listLeads(access, search);

          return new Output(true, [], [], { leads, total: leads.length });

        }

        case "lead_detail": {

          const id = typeof params.leadId === "string" ? params.leadId : null;

          if (!id) return new Output(false, [], ["leadId é obrigatório"], null);

          const lead = await studioBotActionRepository.findLeadDetail(id, access.teamId);

          if (!lead) {

            return new Output(false, [], ["Lead não encontrado"], { errorCode: "LEAD_NOT_FOUND" });

          }

          return new Output(true, [], [], { lead });

        }

        case "agenda_today": {

          const schedules = await studioBotActionRepository.findAgendaToday(access);

          return new Output(true, [], [], { schedules });

        }

        case "list_tasks": {

          const now = new Date();

          return listTasksUseCase.execute({

            teamId: access.teamId,

            dateFrom:

              typeof params.dateFrom === "string" ? new Date(params.dateFrom) : now,

            dateTo:

              typeof params.dateTo === "string"

                ? new Date(params.dateTo)

                : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),

            leadId: typeof params.leadId === "string" ? params.leadId : undefined,

          });

        }

        case "team_digest": {

          const counts = await studioBotActionRepository.getTeamDigestCounts(access.teamId);

          const tasks = await listTasksUseCase.execute({

            teamId: access.teamId,

            dateFrom: new Date(),

            dateTo: new Date(Date.now() + 24 * 60 * 60 * 1000),

          });

          const taskList = tasks.isValid ? (tasks.result as unknown[]) : [];

          return new Output(true, [], [], {

            digest: {

              ...counts,

              tasksDueToday: Array.isArray(taskList) ? taskList.length : 0,

            },

          });

        }

        case "add_note": {

          const id = typeof params.leadId === "string" ? params.leadId : null;

          const body = typeof params.body === "string" ? params.body.trim() : "";

          if (!id || !body) return new Output(false, [], ["leadId e body são obrigatórios"], null);

          const activity = await studioBotActionRepository.createNoteActivity(

            id,

            body,

            access.profileId,

            input.userLinkId,

            input.flowId

          );

          return new Output(true, ["Nota adicionada"], [], { activity });

        }

        case "upload_attachment": {

          const id = typeof params.leadId === "string" ? params.leadId : null;

          const fileName = typeof params.fileName === "string" ? params.fileName : "documento.pdf";

          const fileBase64 = typeof params.fileBase64 === "string" ? params.fileBase64 : null;

          const mimeType =

            typeof params.mimeType === "string" ? params.mimeType : "application/pdf";

          if (!id || !fileBase64) {

            return new Output(false, [], ["leadId e fileBase64 são obrigatórios"], null);

          }

          const buffer = Buffer.from(fileBase64, "base64");

          const file = new File([buffer], fileName, { type: mimeType });

          const uploadResult = await leadAttachmentService.uploadAttachment(

            file,

            id,

            access.profileId

          );

          if (!uploadResult.success || !uploadResult.publicUrl) {

            return new Output(false, [], [uploadResult.error ?? "Erro ao enviar anexo"], null);

          }

          const attachment = await studioBotActionRepository.createAttachmentRecord({

            leadId: id,

            fileName: uploadResult.fileName ?? fileName,

            fileUrl: uploadResult.publicUrl,

            storagePath: uploadResult.fileId ?? "",

            fileType: uploadResult.fileType ?? mimeType,

            fileSize: uploadResult.fileSize ?? buffer.length,

            uploadedBy: access.profileId,

          });

          await studioBotActionRepository.createStudioBotActivity(

            id,

            `Anexo via Bethânia: ${attachment.fileName}`,

            access.profileId,

            input.userLinkId,

            "upload_attachment",

            input.flowId,

            { attachmentId: attachment.id }

          );

          return new Output(true, ["Anexo enviado"], [], { attachment });

        }

        case "schedule_meeting": {

          const id = typeof params.leadId === "string" ? params.leadId : null;

          if (!id) return new Output(false, [], ["leadId é obrigatório"], null);

          const lead = await studioBotActionRepository.findLeadForSchedule(id, access.teamId);

          if (!lead) {

            return new Output(false, [], ["Lead não encontrado"], { errorCode: "LEAD_NOT_FOUND" });

          }

          const closerId =

            typeof params.closerId === "string"

              ? params.closerId

              : lead.closerId ?? access.profileId;

          return leadScheduleService.createSchedule({

            leadId: id,

            leadName: lead.name,

            leadEmail: lead.email,

            leadStatus: lead.status ?? "new_opportunity",

            leadManagerId: lead.managerId ?? access.managerId,

            leadAssignedTo: lead.assignedTo,

            leadAssigneeEmail: lead.assignee?.email ?? null,

            leadCurrentCloserId: lead.closerId,

            leadCode: lead.leadCode,

            closerId,

            teamId: access.teamId,

            meetingDate: typeof params.date === "string" ? params.date : undefined,

            meetingTitle:

              typeof params.meetingTitle === "string"

                ? params.meetingTitle

                : `Reunião: ${lead.name}`,

            meetingNotes: typeof params.notes === "string" ? params.notes : undefined,

            meetingLink: typeof params.meetingLink === "string" ? params.meetingLink : undefined,

            meetingType:

              params.meetingType === "online" ||

              params.meetingType === "call" ||

              params.meetingType === "whatsapp"

                ? params.meetingType

                : "online",

            createdByProfileId: access.profileId,

            transitionStatusToScheduled: params.transitionStatusToScheduled === true,

            confirmNoShowSchedule: params.confirmNoShowSchedule === true,

          });

        }

        case "cancel_meeting": {

          const id = typeof params.leadId === "string" ? params.leadId : null;

          if (!id) return new Output(false, [], ["leadId é obrigatório"], null);

          const exists = await studioBotActionRepository.findLeadInTeam(id, access.teamId);

          if (!exists) {

            return new Output(false, [], ["Lead não encontrado"], { errorCode: "LEAD_NOT_FOUND" });

          }

          const schedule = await studioBotActionRepository.cancelLatestSchedule(id);

          if (!schedule) {

            return new Output(false, [], ["Agendamento não encontrado"], null);

          }

          await studioBotActionRepository.createStudioBotActivity(

            id,

            "Reunião cancelada via Bethânia",

            access.profileId,

            input.userLinkId,

            "cancel_meeting",

            input.flowId

          );

          return new Output(true, ["Reunião cancelada"], [], { leadId: id, scheduleId: schedule.id });

        }

        case "create_task": {

          const id = typeof params.leadId === "string" ? params.leadId : null;

          const title = typeof params.title === "string" ? params.title.trim() : "";

          const body = typeof params.body === "string" ? params.body.trim() : title;

          if (!id || !title) {

            return new Output(false, [], ["leadId e title são obrigatórios"], null);

          }

          const assigneeProfileIds = Array.isArray(params.assigneeProfileIds)

            ? params.assigneeProfileIds.filter((pid): pid is string => typeof pid === "string")

            : [access.profileId];

          const result = await createTaskUseCase.execute({

            leadId: id,

            teamId: access.teamId,

            creatorProfileId: access.profileId,

            title,

            taskType: typeof params.taskType === "string" ? params.taskType : "other",

            body,

            isUrgent: params.isUrgent === true,

            startAt: typeof params.startAt === "string" ? new Date(params.startAt) : null,

            endAt: typeof params.endAt === "string" ? new Date(params.endAt) : null,

            assigneeProfileIds,

          });

          if (result.isValid) {

            await studioBotActionRepository.createStudioBotActivity(

              id,

              `Tarefa via Bethânia: ${title}`,

              access.profileId,

              input.userLinkId,

              "create_task",

              input.flowId

            );

          }

          return result;

        }

        default:

          return new Output(false, [], ["Ação não suportada"], { errorCode: "ACTION_NOT_FOUND" });

      }

    } catch (error) {

      console.error("[BackofficeBotActionUseCase][executeAction]", error);

      return new Output(false, [], ["Erro ao executar ação"], { errorCode: "INTERNAL_ERROR" });

    }

  }

}



export const backofficeBotActionUseCase = new BackofficeBotActionUseCase();

