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
    default:
      return formatActionErrorMessage(["Ação não suportada neste menu."]);
  }
}
