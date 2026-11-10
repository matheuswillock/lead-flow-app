import type {
  DueFollowUpReminder,
  EndingPlan,
  ILeadFollowUpReminderRepository,
  LeadMeetingContext,
  NewFollowUpReminder,
  UpcomingMeeting,
} from "@/app/api/infra/data/repositories/leadFollowUpReminder/ILeadFollowUpReminderRepository"
import type { AppendLeadActivity, CreateFollowUpTask, NotifyProfile } from "./followUpPorts"

/** Dublês em memória para os testes dos casos de uso de acompanhamento. */
export function fakeReminderRepository(seed: {
  due?: DueFollowUpReminder[]
  meetings?: UpcomingMeeting[]
  plans?: EndingPlan[]
  leadMeeting?: LeadMeetingContext | null
} = {}) {
  const stored: (NewFollowUpReminder & { id: string; processedAt: Date | null })[] = []
  const processed: { id: string; taskId: string | null }[] = []
  let nextId = 0
  const repository: ILeadFollowUpReminderRepository = {
    findLeadMeeting: async () => seed.leadMeeting ?? null,
    listForLead: async ({ leadId, kind, anchorAt }) =>
      stored
        .filter((item) => item.leadId === leadId && item.kind === kind && item.anchorAt.getTime() === anchorAt.getTime())
        .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
        .map(({ id, offsetKey, anchorAt: anchor, dueAt, processedAt }) => ({ id, offsetKey, anchorAt: anchor, dueAt, processedAt })),
    deletePending: async ({ id, leadId }) => {
      const index = stored.findIndex((item) => item.id === id && item.leadId === leadId && item.processedAt === null)
      if (index < 0) return false
      stored.splice(index, 1)
      return true
    },
    replacePending: async ({ leadId, kind, reminders }) => {
      for (let i = stored.length - 1; i >= 0; i -= 1) {
        if (stored[i].leadId === leadId && stored[i].kind === kind) stored.splice(i, 1)
      }
      stored.push(...reminders.map((item) => ({ ...item, id: `r-${(nextId += 1)}`, processedAt: null })))
    },
    ensure: async (reminders) => {
      const fresh = reminders.filter(
        (item) =>
          !stored.some(
            (existing) =>
              existing.leadId === item.leadId &&
              existing.kind === item.kind &&
              existing.offsetKey === item.offsetKey &&
              existing.anchorAt.getTime() === item.anchorAt.getTime(),
          ),
      )
      stored.push(...fresh.map((item) => ({ ...item, id: `r-${(nextId += 1)}`, processedAt: null })))
      return fresh.length
    },
    findDue: async () => seed.due ?? [],
    markProcessed: async ({ id, taskId }) => {
      processed.push({ id, taskId })
    },
    findUpcomingMeetings: async () => seed.meetings ?? [],
    findPlansEnding: async () => seed.plans ?? [],
  }
  return { repository, stored, processed }
}

export function recordingPorts(options: { taskFails?: boolean } = {}) {
  const tasks: Parameters<CreateFollowUpTask>[0][] = []
  const alerts: Parameters<NotifyProfile>[0][] = []
  const activities: Parameters<AppendLeadActivity>[0][] = []
  const createTask: CreateFollowUpTask = async (input) => {
    tasks.push(input)
    return options.taskFails ? { taskId: null, error: "Lead fora do time" } : { taskId: `task-${tasks.length}`, error: null }
  }
  const notify: NotifyProfile = async (input) => {
    alerts.push(input)
  }
  const appendActivity: AppendLeadActivity = async (input) => {
    activities.push(input)
  }
  return { createTask, notify, appendActivity, tasks, alerts, activities }
}
