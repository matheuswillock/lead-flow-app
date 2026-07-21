import type { IAssociadosService } from "./IAssociadosService";
import type {
  AssociadosData,
  AssociadosFiltersState,
  AssociateProposalDetail,
  LeadAttachmentOption,
} from "../context/AssociadosTypes";

function headers(supabaseId: string, teamId: string) {
  return {
    "x-supabase-user-id": supabaseId,
    "x-team-id": teamId,
  };
}

async function parseOutput<T>(res: Response, fallback: string): Promise<T> {
  const json = await res.json();
  if (!json.isValid) {
    throw new Error(json.errorMessages?.[0] ?? fallback);
  }
  return json.result as T;
}

export class AssociadosService implements IAssociadosService {
  async listProposals(
    supabaseId: string,
    teamId: string,
    filters: AssociadosFiltersState
  ): Promise<AssociadosData> {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.associateAccountId) params.set("associateAccountId", filters.associateAccountId);
    if (filters.teamId) params.set("teamId", filters.teamId);
    if (filters.closerId) params.set("closerId", filters.closerId);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    params.set("page", String(filters.page));
    params.set("pageSize", String(filters.pageSize));

    const res = await fetch(`/api/v1/associates/proposals?${params.toString()}`, {
      headers: headers(supabaseId, teamId),
    });

    return parseOutput<AssociadosData>(res, "Erro ao listar propostas");
  }

  async getDetail(supabaseId: string, teamId: string, leadId: string) {
    const res = await fetch(`/api/v1/associates/proposals/${leadId}`, {
      headers: headers(supabaseId, teamId),
    });
    return parseOutput<AssociateProposalDetail>(res, "Erro ao carregar detalhe");
  }

  async listLeadAttachments(supabaseId: string, teamId: string, leadId: string) {
    const res = await fetch(`/api/v1/leads/${leadId}/attachments?teamId=${teamId}`, {
      headers: headers(supabaseId, teamId),
    });
    const json = await res.json();
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao listar anexos");
    }
    const attachments = (json.result ?? []) as LeadAttachmentOption[];
    return Array.isArray(attachments) ? attachments : [];
  }

  async criticize(
    supabaseId: string,
    teamId: string,
    leadId: string,
    input: { title: string; message: string }
  ): Promise<void> {
    const res = await fetch(`/api/v1/associates/proposals/${leadId}/criticize`, {
      method: "POST",
      headers: { ...headers(supabaseId, teamId), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    await parseOutput(res, "Erro ao criticar proposta");
  }

  async registerSale(
    supabaseId: string,
    teamId: string,
    leadId: string,
    input: {
      operatorName: string;
      proposalNumber?: string;
      notes?: string;
      attachmentIds?: string[];
    }
  ): Promise<void> {
    const res = await fetch(`/api/v1/associates/proposals/${leadId}/register-sale`, {
      method: "POST",
      headers: { ...headers(supabaseId, teamId), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    await parseOutput(res, "Erro ao registrar venda");
  }

  async approveDocument(supabaseId: string, teamId: string, leadId: string, documentType: string) {
    const res = await fetch(
      `/api/v1/associates/proposals/${leadId}/documents/${documentType}/approve`,
      {
        method: "POST",
        headers: headers(supabaseId, teamId),
      }
    );
    await parseOutput(res, "Erro ao aprovar documento");
  }

  async rejectDocument(
    supabaseId: string,
    teamId: string,
    leadId: string,
    documentType: string,
    reason: string
  ) {
    const res = await fetch(
      `/api/v1/associates/proposals/${leadId}/documents/${documentType}/reject`,
      {
        method: "POST",
        headers: { ...headers(supabaseId, teamId), "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }
    );
    await parseOutput(res, "Erro ao rejeitar documento");
  }

  async linkDocument(
    supabaseId: string,
    teamId: string,
    leadId: string,
    input: { documentType: string; attachmentId: string }
  ) {
    const res = await fetch(`/api/v1/associates/proposals/${leadId}/documents`, {
      method: "POST",
      headers: { ...headers(supabaseId, teamId), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    await parseOutput(res, "Erro ao vincular documento");
  }

  async uploadPaymentProof(supabaseId: string, teamId: string, leadId: string, attachmentId: string) {
    const res = await fetch(`/api/v1/associates/proposals/${leadId}/payment-proof`, {
      method: "POST",
      headers: { ...headers(supabaseId, teamId), "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentId }),
    });
    await parseOutput(res, "Erro ao registrar comprovante");
  }
}

export const associadosService = new AssociadosService();
