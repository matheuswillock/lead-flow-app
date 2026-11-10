import { leadAdministratorInterviewRepository } from "@/app/api/infra/data/repositories/leadAdministratorInterview/LeadAdministratorInterviewRepository"
import { leadFollowUpReminderRepository } from "@/app/api/infra/data/repositories/leadFollowUpReminder/LeadFollowUpReminderRepository"
import { appendFollowUpActivity, createFollowUpTask } from "@/app/api/useCases/leadFollowUp/leadFollowUpComposition"
import { LeadAdministratorInterviewUseCase } from "./LeadAdministratorInterviewUseCase"

export const leadAdministratorInterviewUseCase = new LeadAdministratorInterviewUseCase(
  leadAdministratorInterviewRepository,
  leadFollowUpReminderRepository,
  createFollowUpTask,
  appendFollowUpActivity,
)
