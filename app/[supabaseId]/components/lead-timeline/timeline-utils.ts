import type { LeadActivityResponseDTO } from "@/app/api/v1/leads/DTO/leadResponseDTO"
import { formatIntimezone } from "@/lib/dates"

export type TimelineFilterValue =
  | "all"
  | "note"
  | "call"
  | "whatsapp"
  | "email"
  | "status_change"
  | "task"
  | "studio_bot"

export const TIMELINE_FILTER_OPTIONS: Array<{
  value: TimelineFilterValue
  label: string
}> = [
  { value: "all", label: "Todas" },
  { value: "note", label: "Comentários" },
  { value: "call", label: "Ligações" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mails" },
  { value: "status_change", label: "Status" },
  { value: "task", label: "Tarefas" },
  { value: "studio_bot", label: "Studio Bot" },
]

export function formatActivityDate(value: string, timezone: string): string {
  try {
    return formatIntimezone(new Date(value), "dd/MM/yyyy HH:mm", timezone)
  } catch {
    return value
  }
}

export function getActivityInitials(name: string): string {
  const words = name.trim().split(" ").filter(Boolean)
  if (words.length === 0) return "LF"
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase()
}

export function isScheduleActivity(activity: LeadActivityResponseDTO): boolean {
  if (activity?.payload && typeof activity.payload === "object") {
    const payload = activity.payload as { kind?: string }
    if (payload.kind === "schedule") return true
  }
  return (
    activity.body?.startsWith("Agendamento") ||
    activity.body?.startsWith("Reagendamento") ||
    false
  )
}

export function resolveTimelineItemType(activity: LeadActivityResponseDTO): string {
  if (activity.type === "studio_bot") return "studio_bot"
  if (activity.type === "note" && isScheduleActivity(activity)) return "schedule"
  return activity.type
}

export function activityMatchesFilter(
  activity: LeadActivityResponseDTO,
  filter: TimelineFilterValue
): boolean {
  if (filter === "all") return true
  if (filter === "studio_bot") {
    return activity.type === "studio_bot"
  }
  return activity.type === filter
}
