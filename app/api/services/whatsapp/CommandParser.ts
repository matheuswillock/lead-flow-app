import { LeadStatus } from "@prisma/client";

export type ParsedCommand =
  | { type: "help" }
  | { type: "lead"; query: string }
  | { type: "status"; identifier: string; status: LeadStatus }
  | { type: "new"; name: string; phone: string; email?: string; city?: string; plan?: string }
  | { type: "note"; identifier: string; note: string };

export type ParseResult =
  | { ok: true; command: ParsedCommand }
  | { ok: false; error: string };

const STATUS_VALUES = Object.values(LeadStatus) as string[];

function normalizeStatus(value: string): LeadStatus | null {
  const normalized = value.trim().toLowerCase().replace(/[-\s]+/g, "_");
  const match = STATUS_VALUES.find((status) => status.toLowerCase() === normalized);
  return (match as LeadStatus) || null;
}

export function parseCommand(input: string): ParseResult {
  if (!input) {
    return { ok: false, error: "Mensagem vazia" };
  }

  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return { ok: false, error: "Comando inválido. Use /ajuda para ver as opções." };
  }

  const [rawCommand, ...restParts] = trimmed.split(" ");
  const command = rawCommand.toLowerCase();
  const rest = restParts.join(" ").trim();

  if (command === "/ajuda" || command === "/help") {
    return { ok: true, command: { type: "help" } };
  }

  if (command === "/lead") {
    if (!rest) {
      return { ok: false, error: "Informe um código, id, telefone ou email." };
    }
    return { ok: true, command: { type: "lead", query: rest } };
  }

  if (command === "/status") {
    const [identifier, statusInput] = rest.split(" ");
    if (!identifier || !statusInput) {
      return { ok: false, error: "Uso: /status <leadCode|id> <novo_status>" };
    }
    const status = normalizeStatus(statusInput);
    if (!status) {
      return { ok: false, error: "Status inválido. Use um status do sistema." };
    }
    return { ok: true, command: { type: "status", identifier, status } };
  }

  if (command === "/novo") {
    if (!rest) {
      return { ok: false, error: "Uso: /novo Nome;Telefone;Email;Cidade;Plano" };
    }

    const [name, phone, email, city, plan] = rest.split(";").map((item) => item.trim());

    if (!name || !phone) {
      return { ok: false, error: "Nome e telefone são obrigatórios." };
    }

    return { ok: true, command: { type: "new", name, phone, email, city, plan } };
  }

  if (command === "/nota") {
    const [identifier, ...noteParts] = rest.split(" ");
    const note = noteParts.join(" ").trim();
    if (!identifier || !note) {
      return { ok: false, error: "Uso: /nota <leadCode|id> <texto>" };
    }
    return { ok: true, command: { type: "note", identifier, note } };
  }

  return { ok: false, error: "Comando não reconhecido. Use /ajuda." };
}

export function buildHelpMessage(): string {
  return [
    "Comandos disponíveis:",
    "/ajuda - Mostrar ajuda",
    "/lead <leadCode|id|telefone|email>",
    "/status <leadCode|id> <novo_status>",
    "/novo Nome;Telefone;Email;Cidade;Plano",
    "/nota <leadCode|id> <texto>",
  ].join("\n");
}
