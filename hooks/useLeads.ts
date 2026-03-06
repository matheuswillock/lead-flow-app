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

      if (!response.ok) {
        throw new Error('Erro ao atualizar status do lead');
      }

      const apiResult = await response.json();
      
      // Transform API response to DTO format expected by frontend
      const result: UpdateLeadResponseDTO = {
        success: apiResult.isValid,
        lead: apiResult.result,
        message: apiResult.isValid 
          ? apiResult.successMessages.join(', ') || 'Status do lead atualizado com sucesso'
          : apiResult.errorMessages.join(', ') || 'Erro ao atualizar status do lead'
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

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${id}`, {
        headers: {
          'x-supabase-user-id': supabaseId,
          ...(activeTeamId ? { 'x-team-id': activeTeamId } : {}),
        },
      });
      
      if (!response.ok) {
        throw new Error('Erro ao buscar lead');
      }

      const data = await response.json();
      if (data?.isValid) {
        setLead(data.result as LeadResponseDTO);
      } else {
        const message = Array.isArray(data?.errorMessages) && data.errorMessages.length > 0
          ? data.errorMessages.join(", ")
          : "Erro ao buscar lead";
        setLead(null);
        setError(message);
      }
    } catch (err) {
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
