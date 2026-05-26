import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { LeadStatus } from '@prisma/client';
import { useTeamContext } from '@/app/context/TeamContext';
import { 
  LeadResponseDTO, 
  LeadListResponseDTO,
  CreateLeadResponseDTO,
  UpdateLeadResponseDTO,
  DeleteLeadResponseDTO
} from '@/app/api/v1/leads/DTO/leadResponseDTO';
import { CreateLeadRequest } from '@/app/api/v1/leads/DTO/requestToCreateLead';
import { UpdateLeadRequest } from '@/app/api/v1/leads/DTO/requestToUpdateLead';

interface UseLeadsOptions {
  status?: LeadStatus;
  assignedTo?: string;
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  role?: string;
}

const LEAD_SILENT_FRESH_WINDOW_MS = 1500;
const leadInFlightByKey = new Map<string, Promise<LeadResponseDTO>>();
const leadFreshCacheByKey = new Map<string, { lead: LeadResponseDTO; fetchedAt: number }>();

export const useLeads = () => {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId, activeRole } = useTeamContext();

  const [leads, setLeads] = useState<LeadResponseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const fetchLeads = useCallback(async (newOptions?: UseLeadsOptions) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      const finalOptions = newOptions || {};

      // Always include role in the request
      const roleToUse = finalOptions.role || activeRole || 'manager';
      searchParams.append('role', roleToUse);
      if (activeTeamId) {
        searchParams.append('teamId', activeTeamId);
      }

      if (finalOptions.status) searchParams.append('status', finalOptions.status);
      if (finalOptions.assignedTo) searchParams.append('assignedTo', finalOptions.assignedTo);
      if (finalOptions.page) searchParams.append('page', finalOptions.page.toString());
      if (finalOptions.limit) searchParams.append('limit', finalOptions.limit.toString());
      if (finalOptions.search) searchParams.append('search', finalOptions.search);
      if (finalOptions.startDate) searchParams.append('startDate', finalOptions.startDate);
      if (finalOptions.endDate) searchParams.append('endDate', finalOptions.endDate);

      const response = await fetch(`/api/v1/leads?${searchParams.toString()}`, {
        headers: {
          'x-supabase-user-id': supabaseId,
          ...(activeTeamId ? { 'x-team-id': activeTeamId } : {}),
        },
      });
      
      if (!response.ok) {
        throw new Error('Erro ao buscar leads');
      }

      const data: LeadListResponseDTO = await response.json();
      setLeads(data.leads);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [supabaseId, activeRole, activeTeamId]);

  const createLead = useCallback(async (leadData: CreateLeadRequest): Promise<CreateLeadResponseDTO> => {
    setLoading(true);
    setError(null);

    try {
      console.info('[useLeads] Creating lead with data:', leadData);
      
      const response = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          ...(activeTeamId ? { 'x-team-id': activeTeamId } : {}),
        },
        body: JSON.stringify(leadData),
      });

      const apiResult = await response.json();
      console.info('[useLeads] API Response:', { status: response.status, apiResult });

      // Transform API response to DTO format expected by frontend
      const result: CreateLeadResponseDTO = {
        success: apiResult.isValid,
        lead: apiResult.result,
        message: apiResult.isValid 
          ? apiResult.successMessages?.join(', ') || 'Lead criado com sucesso'
          : apiResult.errorMessages?.join(', ') || 'Erro ao criar lead'
      };
      
      console.info('[useLeads] Transformed result:', result);
      
      // Se não for válido, definir erro mas retornar resultado para tratamento no componente
      if (!apiResult.isValid) {
        console.error('[useLeads] Lead creation failed:', result.message);
        setError(result.message);
      }
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Erro de comunicação com o servidor';
      console.error('[useLeads] Exception during createLead:', err);
      setError(error);
      
      // Retornar resultado de erro ao invés de lançar exceção
      return {
        success: false,
        lead: null,
        message: error
      };
    } finally {
      setLoading(false);
    }
  }, [supabaseId, activeTeamId]);

  const updateLead = useCallback(async (id: string, leadData: UpdateLeadRequest): Promise<UpdateLeadResponseDTO> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          ...(activeTeamId ? { 'x-team-id': activeTeamId } : {}),
        },
        body: JSON.stringify(leadData),
      });

      const apiResult = await response.json();
      
      // Transform API response to DTO format expected by frontend
      const result: UpdateLeadResponseDTO = {
        success: apiResult.isValid,
        lead: apiResult.result,
        message: apiResult.isValid 
          ? apiResult.successMessages?.join(', ') || 'Lead atualizado com sucesso'
          : apiResult.errorMessages?.join(', ') || 'Erro ao atualizar lead'
      };
      
      // Se não for válido, definir erro mas retornar resultado para tratamento no componente
      if (!apiResult.isValid) {
        setError(result.message);
      }
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Erro de comunicação com o servidor';
      setError(error);
      
      // Retornar resultado de erro ao invés de lançar exceção
      return {
        success: false,
        lead: null,
        message: error
      };
    } finally {
      setLoading(false);
    }
  }, [supabaseId, activeTeamId]);

  const deleteLead = useCallback(async (id: string): Promise<DeleteLeadResponseDTO> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${id}`, {
        method: 'DELETE',
        headers: {
          'x-supabase-user-id': supabaseId,
          ...(activeTeamId ? { 'x-team-id': activeTeamId } : {}),
        },
      });

      const apiResult = await response.json();
      
      // Transform API response to DTO format expected by frontend
      const result: DeleteLeadResponseDTO = {
        success: apiResult.isValid,
        message: apiResult.isValid 
          ? apiResult.successMessages?.join(', ') || 'Lead excluído com sucesso'
          : apiResult.errorMessages?.join(', ') || 'Erro ao excluir lead'
      };
      
      // Se não for válido, definir erro mas retornar resultado para tratamento no componente
      if (!apiResult.isValid) {
        setError(result.message);
      }
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Erro de comunicação com o servidor';
      setError(error);
      
      // Retornar resultado de erro ao invés de lançar exceção
      return {
        success: false,
        message: error
      };
    } finally {
      setLoading(false);
    }
  }, [supabaseId, activeTeamId]);

  const updateLeadStatus = useCallback(async (id: string, status: LeadStatus): Promise<UpdateLeadResponseDTO> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          ...(activeTeamId ? { 'x-team-id': activeTeamId } : {}),
        },
        body: JSON.stringify({ status }),
      });

      const apiResult = await response.json().catch(() => null);
      if (!response.ok || !apiResult?.isValid) {
        const message = Array.isArray(apiResult?.errorMessages) && apiResult.errorMessages.length > 0
          ? apiResult.errorMessages.join(', ')
          : 'Erro ao atualizar status do lead';
        throw new Error(message);
      }
      
      // Transform API response to DTO format expected by frontend
      const result: UpdateLeadResponseDTO = {
        success: true,
        lead: apiResult.result,
        message: apiResult.successMessages.join(', ') || 'Status do lead atualizado com sucesso'
      };
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(error);
      throw new Error(error);
    } finally {
      setLoading(false);
    }
  }, [supabaseId, activeTeamId]);

  const assignLeadToOperator = useCallback(async (id: string, operatorId: string): Promise<UpdateLeadResponseDTO> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${id}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          ...(activeTeamId ? { 'x-team-id': activeTeamId } : {}),
        },
        body: JSON.stringify({ operatorId }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atribuir lead ao operador');
      }

      const apiResult = await response.json();
      
      // Transform API response to DTO format expected by frontend
      const result: UpdateLeadResponseDTO = {
        success: apiResult.isValid,
        lead: apiResult.result,
        message: apiResult.isValid 
          ? apiResult.successMessages.join(', ') || 'Lead atribuído ao operador com sucesso'
          : apiResult.errorMessages.join(', ') || 'Erro ao atribuir lead ao operador'
      };
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(error);
      throw new Error(error);
    } finally {
      setLoading(false);
    }
  }, [supabaseId]);

  return {
    leads,
    loading,
    error,
    total,
    totalPages,
    fetchLeads,
    createLead,
    updateLead,
    deleteLead,
    updateLeadStatus,
    assignLeadToOperator,
  };
}

export function useLead(id: string) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();
  
  const [lead, setLead] = useState<LeadResponseDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLead = useCallback(async (options?: { silent?: boolean }) => {
    if (!id) return;
    const silent = options?.silent ?? false;
    const requestKey = `${id}:${supabaseId}:${activeTeamId ?? ''}`;

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const cached = leadFreshCacheByKey.get(requestKey);
      if (silent && cached && Date.now() - cached.fetchedAt <= LEAD_SILENT_FRESH_WINDOW_MS) {
        setLead(cached.lead);
        return;
      }

      const existingRequest = leadInFlightByKey.get(requestKey);
      const requestPromise = existingRequest ?? (async (): Promise<LeadResponseDTO> => {
        const response = await fetch(`/api/v1/leads/${id}`, {
          headers: {
            'x-supabase-user-id': supabaseId,
            ...(activeTeamId ? { 'x-team-id': activeTeamId } : {}),
          },
        });

        let responseBody: { isValid?: boolean; errorMessages?: string[]; result?: unknown } | null = null;
        try { responseBody = await response.json(); } catch { /* sem body JSON */ }

        if (!response.ok || responseBody?.isValid === false) {
          const serverMessage = responseBody?.errorMessages?.join(", ");
          console.error("[useLead] fetch failed", {
            leadId: id,
            status: response.status,
            statusText: response.statusText,
            serverMessage,
            activeTeamId,
          });
          const isTeamMismatch = serverMessage?.includes("sem permissão no seu time");
          throw new Error(
            isTeamMismatch
              ? "Este lead pertence a outro time. Troque o time ativo no menu superior para visualizá-lo."
              : serverMessage || `Erro ao buscar lead (HTTP ${response.status})`
          );
        }

        const nextLead = responseBody!.result as LeadResponseDTO;
        leadFreshCacheByKey.set(requestKey, { lead: nextLead, fetchedAt: Date.now() });
        return nextLead;
      })();

      if (!existingRequest) {
        leadInFlightByKey.set(
          requestKey,
          requestPromise.finally(() => {
            leadInFlightByKey.delete(requestKey);
          })
        );
      }

      const nextLead = await requestPromise;
      setLead(nextLead);
    } catch (err) {
      setLead(null);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [id, supabaseId, activeTeamId]);

  return {
    lead,
    loading,
    error,
    fetchLead,
  };
}
