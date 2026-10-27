import { CREATE_EXAMPLE as CREATE_BODY, SCHEDULE_EXAMPLE as SCHEDULE_BODY } from "@/lib/webhooks/inbound/v2/contractDocs";

/**
 * Conteúdo do guia do webhook de entrada v2 (SPEC 11). Fica separado do JSX para o teste validar os
 * exemplos contra o parser real (`parseInboundV2Payload`) e os códigos contra `INBOUND_RESULT_CODES`.
 */

export const TOKEN_PLACEHOLDER = "SEU_TOKEN_DO_WEBHOOK";
export const AVAILABILITY_TOKEN_PLACEHOLDER = "SEU_TOKEN_DA_API_DE_HORARIOS";

export type GuideRow = { name: string; description: string };

export const REQUEST_HEADERS: GuideRow[] = [
  { name: "Authorization", description: `Obrigatório. "Bearer <token do webhook>".` },
  { name: "Content-Type", description: `Obrigatório. "application/json".` },
  {
    name: "Idempotency-Key",
    description:
      "Recomendado. Texto único por evento, até 255 caracteres. Reenviar o mesmo evento com a mesma chave não cria outro lead.",
  },
];

export const BODY_FIELDS: GuideRow[] = [
  { name: "lead.name", description: "Obrigatório. Nome do lead." },
  { name: "lead.phone", description: "Obrigatório. Telefone do lead." },
  { name: "lead.email", description: "Opcional. Obrigatório quando schedule.type for \"online\"." },
  { name: "lead.cnpj / lead.notes", description: "Opcionais." },
  { name: "external_id", description: "Opcional. Identificador do evento no sistema de vocês; aparece nos logs." },
  { name: "source", description: "Opcional. Origem do lead." },
  {
    name: "assigned_to.profile_id",
    description: "Opcional. Quem recebe o lead. Sem ele, os leads são distribuídos em rodízio entre os SDRs do webhook.",
  },
  { name: "schedule", description: "Opcional. Só quando o lead já deve sair com reunião marcada." },
  { name: "schedule.closer.profile_id", description: "Obrigatório dentro de schedule. O closer_id da API de horários." },
  {
    name: "schedule.starts_at",
    description: "Obrigatório dentro de schedule. Data e hora com fuso (RFC 3339), entre 5 minutos e 180 dias à frente.",
  },
  { name: "schedule.type", description: "Opcional. \"online\", \"call\" ou \"whatsapp\". Sem ele, vale \"call\"." },
  { name: "schedule.title / schedule.notes", description: "Opcionais." },
];

export const DURATION_NOTE =
  "A duração da reunião é a configurada no time (padrão de 30 minutos). Não envie duration_minutes: o campo é ignorado.";

export type OutcomeRow = { situation: string; result: string };

export const OUTCOMES: OutcomeRow[] = [
  { situation: "Sem schedule", result: "Lead criado como nova oportunidade." },
  { situation: "Com schedule e horário livre para o closer", result: "Lead criado como agendado, com a reunião registrada." },
  {
    situation: "Com schedule, mas o closer já está ocupado nesse horário",
    result:
      "Lead criado como nova oportunidade, sem reunião, com o selo \"Remarcar urgente\" no CRM. A agenda do closer é uma só, mesmo que participe de mais de um time.",
  },
  {
    situation: "Webhook sem o escopo de agenda e evento com schedule",
    result: "O lead é criado e a reunião pedida é ignorada.",
  },
  {
    situation: "Contato já existe como nova oportunidade",
    result: "Os dados novos entram no lead existente: campos vazios são preenchidos e as notas são somadas. Nenhum lead novo.",
  },
  { situation: "Contato já existe com reunião agendada", result: "Nada é criado nem alterado." },
  { situation: "Contato já existe em outro status (perdido, finalizado etc.)", result: "Um lead novo é criado." },
];

export type HttpRow = { status: string; meaning: string; action: string };

export const HTTP_RESPONSES: HttpRow[] = [
  {
    status: "202",
    meaning: `Evento recebido. Corpo: { "received": true, "event_id": "..." }.`,
    action: "Nada. O resultado do processamento fica na aba Logs.",
  },
  {
    status: "400",
    meaning: "JSON mal formado (invalid_json), time inválido (invalid_team), Idempotency-Key longa demais (invalid_idempotency_key) ou URL de outra versão do webhook (version_mismatch).",
    action: "Corrigir o corpo ou a URL antes de reenviar.",
  },
  {
    status: "401",
    meaning: "Token ausente, inválido ou expirado (unauthorized, token_expired).",
    action: "Conferir o header Authorization ou gerar um novo token.",
  },
  {
    status: "403",
    meaning: "Sem permissão (missing_scope), webhook desativado (webhook_inactive) ou conta pausada (account_restricted).",
    action: "Ativar o webhook ou ajustar os escopos na aba Configuração.",
  },
  { status: "413", meaning: "Corpo grande demais.", action: "Reduzir o tamanho do corpo." },
  { status: "429", meaning: "Limite de chamadas atingido.", action: "Esperar o tempo do header Retry-After." },
];

export const PROCESSING_NOTE =
  "Um evento com JSON válido, mas com dado faltando (por exemplo, sem lead.name), também recebe 202. O erro aparece depois, na aba Logs. Em falha de rede, timeout ou 5xx, reenvie o mesmo evento com a mesma Idempotency-Key.";

export const SECURITY_NOTES: string[] = [
  "Use sempre HTTPS.",
  "Não coloque o token na URL, em query string nem em log.",
  "Guarde o token em variável de ambiente ou cofre, nunca no código.",
  "A chamada é de servidor para servidor: o token não pode ir para navegador ou aplicativo do cliente final.",
];

export function buildCurlCreate(webhookUrl: string): string {
  return [
    `curl -X POST "${webhookUrl}" \\`,
    `  -H "Authorization: Bearer ${TOKEN_PLACEHOLDER}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Idempotency-Key: evento-123" \\`,
    `  -d '${JSON.stringify(CREATE_BODY, null, 2).replaceAll("\n", "\n  ")}'`,
  ].join("\n");
}

export function buildCurlSchedule(webhookUrl: string): string {
  return [
    `curl -X POST "${webhookUrl}" \\`,
    `  -H "Authorization: Bearer ${TOKEN_PLACEHOLDER}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Idempotency-Key: evento-124" \\`,
    `  -d '${JSON.stringify(SCHEDULE_BODY, null, 2).replaceAll("\n", "\n  ")}'`,
  ].join("\n");
}

export function buildCurlAvailability(origin: string): string {
  return [
    `curl -G "${origin}/api/studio/v1/availability" \\`,
    `  -H "Authorization: Bearer ${AVAILABILITY_TOKEN_PLACEHOLDER}" \\`,
    `  --data-urlencode "date=AAAA-MM-DD"`,
  ].join("\n");
}

export { CREATE_BODY, SCHEDULE_BODY };
