const PERMISSION_DENIED_MESSAGE =
  "Você não tem permissão para esta opção. Digite *menu* para ver o que está disponível.";

const LIST_FOOTER = "Digite o código do lead ou *menu* para voltar.";

type LeadListItem = {
  leadCode?: string | number | null;
  name?: string | null;
  status?: string | null;
};

type AgendaItem = {
  date?: Date | string | null;
  meetingTitle?: string | null;
  lead?: { leadCode?: string | number | null; name?: string | null } | null;
};

type TaskListItem = {
  title?: string | null;
  startAt?: Date | string | null;
  endAt?: Date | string | null;
};

type TeamDigest = {
  leadCount?: number;
  scheduleCount?: number;
  tasksDueToday?: number;
};

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatPermissionDeniedMessage(): string {
  return PERMISSION_DENIED_MESSAGE;
}

export function formatActionErrorMessage(errorMessages: string[]): string {
  const first = errorMessages.find((message) => message.trim().length > 0);
  return first?.trim() || "Não consegui concluir essa ação. Digite *menu* para tentar de novo.";
}

export function formatLeadListReply(
  leads: LeadListItem[],
  options?: { title?: string; emptyMessage?: string }
): string {
  const title = options?.title ?? "*Meus leads*";
  if (!leads.length) {
    return `${title}\n\n${options?.emptyMessage ?? "Nenhum lead encontrado."}\n\nDigite *menu* para voltar.`;
  }

  const lines = leads.map((lead) => {
    const code = lead.leadCode != null ? String(lead.leadCode) : "—";
    const name = lead.name?.trim() || "Sem nome";
    const status = lead.status?.trim() || "—";
    return `${code} — ${name} — ${status}`;
  });

  return `${title}\n\n${lines.join("\n")}\n\n${LIST_FOOTER}`;
}

export function formatAgendaTodayReply(schedules: AgendaItem[]): string {
  if (!schedules.length) {
    return "*Agenda de hoje*\n\nSem reuniões hoje.\n\nDigite *menu* para voltar.";
  }

  const lines = schedules.map((item) => {
    const time = formatTime(item.date);
    const leadLabel =
      item.lead?.leadCode != null
        ? `${item.lead.leadCode} — ${item.lead.name?.trim() || "Lead"}`
        : item.lead?.name?.trim() || "Lead";
    const title = item.meetingTitle?.trim() || "Reunião";
    return `${time} — ${leadLabel} — ${title}`;
  });

  return `*Agenda de hoje*\n\n${lines.join("\n")}\n\nDigite *menu* para voltar.`;
}

export function formatTasksReply(tasks: TaskListItem[]): string {
  if (!tasks.length) {
    return "*Minhas tarefas*\n\nSem tarefas no período.\n\nDigite *menu* para voltar.";
  }

  const lines = tasks.slice(0, 15).map((task) => {
    const title = task.title?.trim() || "Tarefa";
    const due = formatDateTime(task.endAt ?? task.startAt);
    return `• ${title} — ${due}`;
  });

  return `*Minhas tarefas*\n\n${lines.join("\n")}\n\nDigite *menu* para voltar.`;
}

export function formatTeamDigestReply(digest: TeamDigest): string {
  const leads = digest.leadCount ?? 0;
  const schedules = digest.scheduleCount ?? 0;
  const tasks = digest.tasksDueToday ?? 0;
  return [
    "*Resumo do time*",
    "",
    `Leads: ${leads}`,
    `Reuniões futuras: ${schedules}`,
    `Tarefas com vencimento hoje: ${tasks}`,
    "",
    "Digite *menu* para voltar.",
  ].join("\n");
}

export function formatSearchQueryPrompt(): string {
  return "Envie o nome ou código do lead para buscar.\n\nDigite *menu* para cancelar.";
}

type LeadDetail = {
  id?: string;
  leadCode?: string | number | null;
  name?: string | null;
  status?: string | null;
  phone?: string | null;
  email?: string | null;
  meetingDate?: Date | string | null;
  meetingTitle?: string | null;
  assignee?: { fullName?: string | null } | null;
};

export function formatLeadSubmenu(lead: LeadDetail): string {
  const code = lead.leadCode != null ? String(lead.leadCode) : "—";
  const name = lead.name?.trim() || "Sem nome";
  const status = lead.status?.trim() || "—";
  const meeting =
    lead.meetingTitle?.trim() || lead.meetingDate
      ? `${lead.meetingTitle?.trim() || "Reunião"} — ${formatDateTime(lead.meetingDate)}`
      : "—";

  return [
    `*Lead ${code} — ${name}*`,
    `Status: ${status}`,
    `Próxima reunião: ${meeting}`,
    "",
    "1 — Ver detalhes",
    "2 — Adicionar nota",
    "3 — Reunião",
    "4 — Nova tarefa",
    "5 — Enviar documento",
    "6 — Voltar",
  ].join("\n");
}

export function formatLeadDetailReply(lead: LeadDetail): string {
  const code = lead.leadCode != null ? String(lead.leadCode) : "—";
  const name = lead.name?.trim() || "Sem nome";
  const lines = [
    `*Detalhes — ${code}*`,
    `Nome: ${name}`,
    `Status: ${lead.status?.trim() || "—"}`,
    `Telefone: ${lead.phone?.trim() || "—"}`,
    `E-mail: ${lead.email?.trim() || "—"}`,
    `Responsável: ${lead.assignee?.fullName?.trim() || "—"}`,
    `Reunião: ${
      lead.meetingTitle?.trim() || lead.meetingDate
        ? `${lead.meetingTitle?.trim() || "Reunião"} — ${formatDateTime(lead.meetingDate)}`
        : "—"
    }`,
    "",
    "Digite *3* para reunião, *5* para documento ou *6* para voltar ao menu.",
  ];
  return lines.join("\n");
}

export function formatNotePrompt(leadCode?: string | number | null): string {
  const code = leadCode != null ? String(leadCode) : "lead";
  return `Envie o texto da nota para o lead *${code}*.\n\nDigite *menu* para cancelar.`;
}

export function formatTaskPrompt(leadCode?: string | number | null): string {
  const code = leadCode != null ? String(leadCode) : "lead";
  return `Envie o título da tarefa para o lead *${code}*.\n\nDigite *menu* para cancelar.`;
}

export function formatMeetingMenu(): string {
  return [
    "*Reunião*",
    "",
    "1 — Agendar reunião",
    "2 — Cancelar reunião",
    "6 — Voltar ao lead",
  ].join("\n");
}

export function formatMeetingDatetimePrompt(leadCode?: string | number | null): string {
  const code = leadCode != null ? String(leadCode) : "lead";
  return [
    `Envie a data e hora da reunião do lead *${code}* neste formato:`,
    `*DD/MM/AAAA HH:mm*`,
    "",
    "Opcional: título após `|`",
    "Ex.: `15/07/2026 14:30 | Visita técnica`",
    "",
    "Digite *menu* para cancelar.",
  ].join("\n");
}

export function formatDocumentPrompt(leadCode?: string | number | null): string {
  const code = leadCode != null ? String(leadCode) : "lead";
  return [
    `Envie uma *imagem* ou *documento* (PDF, etc.) para anexar ao lead *${code}*.`,
    "",
    "Digite *menu* para cancelar.",
  ].join("\n");
}

export function formatNoteAddedReply(): string {
  return "Nota adicionada com sucesso.\n\nDigite *6* para o submenu do lead ou *menu* para o início.";
}

export function formatTaskCreatedReply(title: string): string {
  return `Tarefa criada: *${title}*\n\nDigite *6* para o submenu do lead ou *menu* para o início.`;
}

export function formatMeetingScheduledReply(meetingDate?: Date | string | null, title?: string | null): string {
  const when = formatDateTime(meetingDate);
  const label = title?.trim() || "Reunião";
  return `Reunião agendada: *${label}* — ${when}\n\nDigite *6* para o submenu do lead ou *menu* para o início.`;
}

export function formatMeetingCancelledReply(): string {
  return "Reunião cancelada.\n\nDigite *6* para o submenu do lead ou *menu* para o início.";
}

export function formatAttachmentUploadedReply(fileName?: string | null): string {
  const name = fileName?.trim() || "arquivo";
  return `Documento enviado: *${name}*\n\nDigite *6* para o submenu do lead ou *menu* para o início.`;
}

export function formatComingSoonReply(feature: string): string {
  return `*${feature}* ainda não está disponível no WhatsApp.\nUse o Corretor Studio por enquanto.\n\nDigite *6* para o submenu ou *menu* para o início.`;
}

export function formatActionReply(
  action: string,
  result: unknown,
  errorMessages: string[] = []
): string {
  if (errorMessages.length > 0) {
    return formatActionErrorMessage(errorMessages);
  }

  const payload = (result ?? {}) as Record<string, unknown>;

  switch (action) {
    case "list_leads":
      return formatLeadListReply(Array.isArray(payload.leads) ? (payload.leads as LeadListItem[]) : []);
    case "search_lead":
      return formatLeadListReply(Array.isArray(payload.leads) ? (payload.leads as LeadListItem[]) : [], {
        title: "*Busca de leads*",
        emptyMessage: "Nenhum lead encontrado para essa busca.",
      });
    case "lead_detail": {
      const lead =
        payload.lead && typeof payload.lead === "object" ? (payload.lead as LeadDetail) : {};
      return `${formatLeadDetailReply(lead)}\n\n${formatLeadSubmenu(lead)}`;
    }
    case "agenda_today":
      return formatAgendaTodayReply(
        Array.isArray(payload.schedules) ? (payload.schedules as AgendaItem[]) : []
      );
    case "list_tasks":
      return formatTasksReply(Array.isArray(result) ? (result as TaskListItem[]) : []);
    case "team_digest": {
      const digest =
        payload.digest && typeof payload.digest === "object"
          ? (payload.digest as TeamDigest)
          : {};
      return formatTeamDigestReply(digest);
    }
    case "add_note":
      return formatNoteAddedReply();
    case "create_task": {
      const title =
        typeof payload.title === "string"
          ? payload.title
          : typeof (payload.task as { title?: string } | undefined)?.title === "string"
            ? (payload.task as { title: string }).title
            : "Tarefa";
      return formatTaskCreatedReply(title);
    }
    case "schedule_meeting": {
      const meetingDate =
        (payload.meetingDate as Date | string | null | undefined) ??
        (payload.date as Date | string | null | undefined) ??
        null;
      const title =
        typeof payload.meetingTitle === "string"
          ? payload.meetingTitle
          : typeof payload.title === "string"
            ? payload.title
            : null;
      return formatMeetingScheduledReply(meetingDate, title);
    }
    case "cancel_meeting":
      return formatMeetingCancelledReply();
    case "upload_attachment": {
      const attachment = payload.attachment as { fileName?: string } | undefined;
      const fileName =
        typeof attachment?.fileName === "string"
          ? attachment.fileName
          : typeof payload.fileName === "string"
            ? payload.fileName
            : null;
      return formatAttachmentUploadedReply(fileName);
    }
    default:
      return formatActionErrorMessage(["Ação não suportada neste menu."]);
  }
}
