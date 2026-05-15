import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod/v3";
import { hashMcpToken } from "@/lib/mcp-token";
import { McpTokenRepository } from "@/app/api/infra/data/repositories/mcpToken/McpTokenRepository";
import { CrmMcpRepository } from "@/app/api/infra/data/repositories/mcpToken/CrmMcpRepository";
import type { LeadStatus, ActivityType } from "@prisma/client";

export const maxDuration = 60;

const tokenRepo = new McpTokenRepository();
const crmRepo = new CrmMcpRepository();

const LEAD_STATUSES = [
  "new_opportunity", "scheduled", "no_show", "pricingRequest",
  "future_sale", "offerNegotiation", "pending_documents", "offerSubmission",
  "dps_agreement", "invoicePayment", "disqualified", "opportunityLost",
  "operator_denied", "contract_finalized",
] as const;

async function verifyToken(
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken?.startsWith("cs_live_")) return undefined;
  const hash = hashMcpToken(bearerToken);
  const record = await tokenRepo.findActiveByHash(hash);
  if (!record) return undefined;
  tokenRepo.touchLastUsed(record.id).catch(() => null);
  return {
    token: bearerToken,
    clientId: record.teamId,
    scopes: ["crm"],
    extra: { teamId: record.teamId },
  };
}

const mcpHandler = createMcpHandler(
  (server) => {
    // ── LISTAR LEADS ────────────────────────────────────────────────────────
    // @ts-ignore — TS2589: zod enum + registerTool generic hits instantiation depth limit
    server.registerTool(
      "listar_leads",
      {
        description: "Lista os leads do time com filtros opcionais.",
        inputSchema: {
          status: z.enum(LEAD_STATUSES).optional(),
          search: z.string().optional(),
          assignedTo: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        },
      },
      async ({ status, search, assignedTo, limit, offset }, extra) => {
        const teamId = extra.authInfo?.extra?.teamId as string;
        const result = await crmRepo.listLeads({
          teamId,
          status: status as LeadStatus | undefined,
          search,
          assignedTo,
          limit,
          offset,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      }
    );

    // ── BUSCAR LEAD ──────────────────────────────────────────────────────────
    server.registerTool(
      "buscar_lead",
      {
        description: "Busca um lead pelo ID ou leadCode.",
        inputSchema: {
          id: z.string().optional(),
          leadCode: z.string().optional(),
        },
      },
      async ({ id, leadCode }, extra) => {
        const teamId = extra.authInfo?.extra?.teamId as string;
        if (!id && !leadCode) {
          return { content: [{ type: "text" as const, text: "Informe id ou leadCode." }], isError: true };
        }
        const lead = await crmRepo.findLead(teamId, id, leadCode);
        if (!lead) {
          return { content: [{ type: "text" as const, text: "Lead não encontrado." }], isError: true };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(lead, null, 2) }] };
      }
    );

    // ── CRIAR LEAD ───────────────────────────────────────────────────────────
    server.registerTool(
      "criar_lead",
      {
        description: "Cria um novo lead no time.",
        inputSchema: {
          name: z.string().min(1),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          cnpj: z.string().optional(),
          age: z.string().optional(),
          currentHealthPlan: z.string().optional(),
          notes: z.string().optional(),
          assignedTo: z.string().uuid().optional(),
          closerId: z.string().uuid().optional(),
        },
      },
      async (args, extra) => {
        const teamId = extra.authInfo?.extra?.teamId as string;
        const masterId = await crmRepo.getTeamMasterId(teamId);
        if (!masterId) {
          return { content: [{ type: "text" as const, text: "Time não encontrado." }], isError: true };
        }
        const count = await crmRepo.countLeads(teamId);
        const leadCode = `LC-${String(count + 1).padStart(5, "0")}`;
        const lead = await crmRepo.createLead({
          leadCode, teamId, managerId: masterId,
          name: args.name,
          email: args.email ?? null,
          phone: args.phone ?? null,
          cnpj: args.cnpj ?? null,
          age: args.age ?? null,
          currentHealthPlan: args.currentHealthPlan ?? null,
          notes: args.notes ?? null,
          assignedTo: args.assignedTo ?? null,
          closerId: args.closerId ?? null,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(lead, null, 2) }] };
      }
    );

    // ── ATUALIZAR LEAD ───────────────────────────────────────────────────────
    // @ts-ignore — TS2589: spread destructure + deep generic hits instantiation depth limit
    server.registerTool(
      "atualizar_lead",
      {
        description: "Atualiza campos de um lead existente.",
        inputSchema: {
          id: z.string().uuid(),
          name: z.string().min(1).optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          age: z.string().optional(),
          currentHealthPlan: z.string().optional(),
          notes: z.string().optional(),
          followUpNotes: z.string().optional(),
          followUpAt: z.string().datetime().optional(),
          assignedTo: z.string().uuid().optional(),
          closerId: z.string().uuid().optional(),
        },
      },
      async ({ id, ...fields }, extra) => {
        const teamId = extra.authInfo?.extra?.teamId as string;
        const exists = await crmRepo.leadBelongsToTeam(id, teamId);
        if (!exists) {
          return { content: [{ type: "text" as const, text: "Lead não encontrado." }], isError: true };
        }
        const data: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(fields)) {
          if (v !== undefined) data[k] = v;
        }
        if (data.followUpAt) data.followUpAt = new Date(data.followUpAt as string);
        const updated = await crmRepo.updateLead(id, data);
        return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
      }
    );

    // ── ATUALIZAR STATUS DO LEAD ─────────────────────────────────────────────
    // @ts-ignore — TS2589: zod enum + registerTool generic hits instantiation depth limit
    server.registerTool(
      "atualizar_status_lead",
      {
        description: "Atualiza o status de um lead.",
        inputSchema: {
          id: z.string().uuid(),
          status: z.enum(LEAD_STATUSES),
        },
      },
      async ({ id, status }, extra) => {
        const teamId = extra.authInfo?.extra?.teamId as string;
        const exists = await crmRepo.leadBelongsToTeam(id, teamId);
        if (!exists) {
          return { content: [{ type: "text" as const, text: "Lead não encontrado." }], isError: true };
        }
        const updated = await crmRepo.updateLeadStatus(id, status as LeadStatus);
        return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
      }
    );

    // ── LISTAR ATIVIDADES DO LEAD ────────────────────────────────────────────
    server.registerTool(
      "listar_atividades_lead",
      {
        description: "Lista as atividades registradas em um lead.",
        inputSchema: {
          leadId: z.string().uuid(),
          limit: z.number().int().min(1).max(100).default(20),
        },
      },
      async ({ leadId, limit }, extra) => {
        const teamId = extra.authInfo?.extra?.teamId as string;
        const exists = await crmRepo.leadBelongsToTeam(leadId, teamId);
        if (!exists) {
          return { content: [{ type: "text" as const, text: "Lead não encontrado." }], isError: true };
        }
        const activities = await crmRepo.listActivities(leadId, limit);
        return { content: [{ type: "text" as const, text: JSON.stringify(activities, null, 2) }] };
      }
    );

    // ── CRIAR ATIVIDADE NO LEAD ──────────────────────────────────────────────
    // @ts-ignore — TS2589: zod enum + registerTool generic hits instantiation depth limit
    server.registerTool(
      "criar_atividade_lead",
      {
        description: "Registra uma atividade (nota, ligação ou WhatsApp) em um lead.",
        inputSchema: {
          leadId: z.string().uuid(),
          type: z.enum(["note", "call", "whatsapp"]),
          body: z.string().min(1),
        },
      },
      async ({ leadId, type, body }, extra) => {
        const teamId = extra.authInfo?.extra?.teamId as string;
        const lead = await crmRepo.findLeadForActivity(leadId, teamId);
        if (!lead) {
          return { content: [{ type: "text" as const, text: "Lead não encontrado." }], isError: true };
        }
        const activity = await crmRepo.createActivity(leadId, type as ActivityType, body, lead.managerId);
        return { content: [{ type: "text" as const, text: JSON.stringify(activity, null, 2) }] };
      }
    );

    // ── LISTAR MEMBROS DO TIME ───────────────────────────────────────────────
    server.registerTool(
      "listar_membros_time",
      {
        description: "Lista os membros do time com nome, email e função.",
        inputSchema: {},
      },
      async (_args, extra) => {
        const teamId = extra.authInfo?.extra?.teamId as string;
        const members = await crmRepo.listTeamMembers(teamId);
        return { content: [{ type: "text" as const, text: JSON.stringify(members, null, 2) }] };
      }
    );
  },
  {},
  { basePath: "/api/mcp", maxDuration: 60 }
);

const authHandler = withMcpAuth(mcpHandler, verifyToken, { required: true });

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
