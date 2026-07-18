export type BotPolicyAction =
  | "view_lead_list"
  | "view_lead_detail"
  | "add_note"
  | "upload_attachment"
  | "schedule_meeting"
  | "cancel_meeting"
  | "create_task"
  | "view_team_digest"
  | "transfer_lead";

/** Maps inbound/N8N action names to BotPolicyAction capabilities. */
export const ACTION_POLICY_MAP: Record<string, BotPolicyAction> = {
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
  transfer_lead: "transfer_lead",
};

export const READ_ACTIONS = new Set([
  "list_leads",
  "lead_detail",
  "agenda_today",
  "list_tasks",
  "search_lead",
  "team_digest",
]);

export const WRITE_ACTIONS = new Set([
  "add_note",
  "upload_attachment",
  "schedule_meeting",
  "cancel_meeting",
  "create_task",
  "transfer_lead",
]);

export function resolvePolicyAction(action: string): BotPolicyAction | null {
  return ACTION_POLICY_MAP[action] ?? null;
}

export function isAllowedBotAction(action: string): boolean {
  return action in ACTION_POLICY_MAP;
}
