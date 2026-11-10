import type { LucideIcon } from "lucide-react"
import { CalendarDays, ClipboardList, Globe, Mail } from "lucide-react"

type IntegrationTone = "success" | "danger" | "info" | "new"

export type IntegrationItem = {
  title: string
  description: string
  icon: LucideIcon
  tone: IntegrationTone
}

export const integrationsData: IntegrationItem[] = [
  {
    title: "Site, Instagram e Meta",
    description: "Conecte os leads do seu site, Instagram e Meta Ads e centralize tudo no CRM.",
    icon: Globe,
    tone: "success",
  },
  {
    title: "E-mails",
    description: "Campanhas segmentadas direto da base comercial.",
    icon: Mail,
    tone: "danger",
  },
  {
    title: "Formulários",
    description: "Leads de campanhas de marketing via e-mail caem direto no pipeline.",
    icon: ClipboardList,
    tone: "info",
  },
  {
    title: "Google Calendar",
    description: "Reuniões, agendamentos e tarefas sincronizados com a sua agenda.",
    icon: CalendarDays,
    tone: "new",
  },
]
