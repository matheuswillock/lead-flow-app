import type { EmailLogCategory } from "@prisma/client"

export const EMAIL_LOG_CATEGORY_LABELS: Record<EmailLogCategory, string> = {
  campaign: "Campanha",
  meeting_invite: "Convite de reunião",
  schedule_notification: "Notificação de agenda",
  transactional: "Transacional",
  other: "Outro",
}

export function getEmailLogCategoryLabel(category: EmailLogCategory): string {
  return EMAIL_LOG_CATEGORY_LABELS[category] ?? category
}
