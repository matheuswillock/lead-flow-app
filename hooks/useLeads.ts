import { useState, useCallback } from 'react';
import { LeadStatus } from '@prisma/client';
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
}

export function useLeads(options?: UseLeadsOptions) {
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
      const finalOptions = { ...options, ...newOptions };

      if (finalOptions.status) searchParams.append('status', finalOptions.status);
      if (finalOptions.assignedTo) searchParams.append('assignedTo', finalOptions.assignedTo);
      if (finalOptions.page) searchParams.append('page', finalOptions.page.toString());
      if (finalOptions.limit) searchParams.append('limit', finalOptions.limit.toString());
      if (finalOptions.search) searchParams.append('search', finalOptions.search);
      if (finalOptions.startDate) searchParams.append('startDate', finalOptions.startDate);
      if (finalOptions.endDate) searchParams.append('endDate', finalOptions.endDate);

      const response = await fetch(`/api/v1/leads?${searchParams.toString()}`);
      
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
  }, [options]);

  const createLead = useCallback(async (leadData: CreateLeadRequest): Promise<CreateLeadResponseDTO> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
      });

      if (!response.ok) {
        throw new Error('Erro ao criar lead');
      }

      const result: CreateLeadResponseDTO = await response.json();
      
      // Atualizar a lista de leads
      await fetchLeads();
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(error);
      throw new Error(error);
    } finally {
      setLoading(false);
    }
  }, [fetchLeads]);

  const updateLead = useCallback(async (id: string, leadData: UpdateLeadRequest): Promise<UpdateLeadResponseDTO> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar lead');
      }

      const result: UpdateLeadResponseDTO = await response.json();
      
      // Atualizar a lista de leads
      await fetchLeads();
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(error);
      throw new Error(error);
    } finally {
      setLoading(false);
    }
  }, [fetchLeads]);

  const deleteLead = useCallback(async (id: string): Promise<DeleteLeadResponseDTO> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao excluir lead');
      }

      const result: DeleteLeadResponseDTO = await response.json();
      
      // Atualizar a lista de leads
      await fetchLeads();
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(error);
      throw new Error(error);
    } finally {
      setLoading(false);
    }
  }, [fetchLeads]);

  const updateLeadStatus = useCallback(async (id: string, status: LeadStatus): Promise<UpdateLeadResponseDTO> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar status do lead');
      }

      const result: UpdateLeadResponseDTO = await response.json();
      
      // Atualizar a lista de leads
      await fetchLeads();
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(error);
      throw new Error(error);
    } finally {
      setLoading(false);
    }
  }, [fetchLeads]);

  const assignLeadToOperator = useCallback(async (id: string, operatorId: string): Promise<UpdateLeadResponseDTO> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${id}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operatorId }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atribuir lead ao operador');
      }

      const result: UpdateLeadResponseDTO = await response.json();
      
      // Atualizar a lista de leads
      await fetchLeads();
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(error);
      throw new Error(error);
    } finally {
      setLoading(false);
    }
  }, [fetchLeads]);

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
  const [lead, setLead] = useState<LeadResponseDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLead = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${id}`);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar lead');
      }

      const data: LeadResponseDTO = await response.json();
      setLead(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [id]);

  return {
    lead,
    loading,
    error,
    fetchLead,
  };
}