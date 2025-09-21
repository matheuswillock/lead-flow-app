import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
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
  role?: string;
}

export const useLeads = () => {
  const params = useParams();
  const supabaseId = params.supabaseId as string;

  const [leads, setLeads] = useState<LeadResponseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [userRole, setUserRole] = useState<string>('manager'); // Default role

  // Fetch user profile to get role
  const fetchUserProfile = useCallback(async () => {
    if (!supabaseId) return;
    
    try {
      const response = await fetch(`/api/v1/profiles/${supabaseId}`, {
        headers: {
          'x-supabase-user-id': supabaseId,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.isValid && data.result?.role) {
          setUserRole(data.result.role);
        }
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  }, [supabaseId]);

  // Load user profile when hook initializes
  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const fetchLeads = useCallback(async (newOptions?: UseLeadsOptions) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      const finalOptions = newOptions || {};

      // Always include role in the request
      const roleToUse = finalOptions.role || userRole;
      searchParams.append('role', roleToUse);

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
  }, [supabaseId, userRole]);

  const createLead = useCallback(async (leadData: CreateLeadRequest): Promise<CreateLeadResponseDTO> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
        },
        body: JSON.stringify(leadData),
      });

      if (!response.ok) {
        throw new Error('Erro ao criar lead');
      }

      const apiResult = await response.json();
      
      // Transform API response to DTO format expected by frontend
      const result: CreateLeadResponseDTO = {
        success: apiResult.isValid,
        lead: apiResult.result,
        message: apiResult.isValid 
          ? apiResult.successMessages.join(', ') || 'Lead criado com sucesso'
          : apiResult.errorMessages.join(', ') || 'Erro ao criar lead'
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

  const updateLead = useCallback(async (id: string, leadData: UpdateLeadRequest): Promise<UpdateLeadResponseDTO> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
        },
        body: JSON.stringify(leadData),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar lead');
      }

      const apiResult = await response.json();
      
      // Transform API response to DTO format expected by frontend
      const result: UpdateLeadResponseDTO = {
        success: apiResult.isValid,
        lead: apiResult.result,
        message: apiResult.isValid 
          ? apiResult.successMessages.join(', ') || 'Lead atualizado com sucesso'
          : apiResult.errorMessages.join(', ') || 'Erro ao atualizar lead'
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

  const deleteLead = useCallback(async (id: string): Promise<DeleteLeadResponseDTO> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${id}`, {
        method: 'DELETE',
        headers: {
          'x-supabase-user-id': supabaseId,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao excluir lead');
      }

      const apiResult = await response.json();
      
      // Transform API response to DTO format expected by frontend
      const result: DeleteLeadResponseDTO = {
        success: apiResult.isValid,
        message: apiResult.isValid 
          ? apiResult.successMessages.join(', ') || 'Lead excluído com sucesso'
          : apiResult.errorMessages.join(', ') || 'Erro ao excluir lead'
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

  const updateLeadStatus = useCallback(async (id: string, status: LeadStatus): Promise<UpdateLeadResponseDTO> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
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
  }, [supabaseId]);

  const assignLeadToOperator = useCallback(async (id: string, operatorId: string): Promise<UpdateLeadResponseDTO> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${id}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
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
  
  const [lead, setLead] = useState<LeadResponseDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLead = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${id}`, {
        headers: {
          'x-supabase-user-id': supabaseId,
        },
      });
      
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
  }, [id, supabaseId]);

  return {
    lead,
    loading,
    error,
    fetchLead,
  };
}