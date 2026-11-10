import { 
  CreateManagerUserFormData, 
  UpdateManagerUserFormData,
  ManagerUsersApiResponse,
  ManagerUserApiResponse,
  ManagerUserTeamsApiResponse
} from "../types";
import { isManagerLikeRole } from "@/lib/roles";
import { API_CLIENT_BASE } from "@/lib/route-map";
import type { TeamMemberAccessHistory, TeamMemberAccessSummary } from "@/lib/team-member-access/access-history";

class ManagerUsersService {
  private baseUrl: string;
  private supabaseId: string;
  private teamId: string | null;

  constructor(supabaseId: string, teamId: string | null) {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
    this.supabaseId = supabaseId;
    this.teamId = teamId;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${API_CLIENT_BASE}/manager${endpoint}`;
    
    const defaultHeaders = {
      "Content-Type": "application/json",
      "x-supabase-user-id": this.supabaseId,
      ...(this.teamId ? { "x-team-id": this.teamId } : {}),
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body && body.isValid === false) {
        return body as T;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Buscar todos os usuários (managers e operators)
  async getUsers(): Promise<ManagerUsersApiResponse> {
    return this.makeRequest<ManagerUsersApiResponse>(`/${this.supabaseId}/users`);
  }

  // Criar novo usuário
  async createUser(
    userData: CreateManagerUserFormData
  ): Promise<ManagerUserApiResponse> {
    return this.makeRequest<ManagerUserApiResponse>(`/${this.supabaseId}/users`, {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  // Atualizar usuário existente
  async updateUser(
    userId: string,
    userData: UpdateManagerUserFormData
  ): Promise<ManagerUserApiResponse> {
    return this.makeRequest<ManagerUserApiResponse>(`/${this.supabaseId}/users`, {
      method: "PUT",
      body: JSON.stringify({
        id: userId,
        ...userData,
      }),
    });
  }

  // Deletar usuário
  async deleteUser(
    userId: string
  ): Promise<ManagerUserApiResponse> {
    return this.makeRequest<ManagerUserApiResponse>(`/${this.supabaseId}/users`, {
      method: "DELETE",
      body: JSON.stringify({ userId }),
    });
  }

  // Verificar se usuário pode ser deletado
  async canDeleteUser(userId: string): Promise<boolean> {
    try {
      const response = await this.getUsers();
      if (!response.isValid || !response.result) {
        return false;
      }

      const users = response.result;
      const user = users.find(u => u.id === userId);
      
      if (!user) return false;

      // Como agora só retornamos operators, qualquer usuário na lista pode ser deletado
      // (exceto se houver outras regras de negócio específicas)
      return true;
    } catch (error) {
      console.error("Erro ao verificar se usuário pode ser deletado:", error);
      return false;
    }
  }

  // Verificar se usuário pode editar outro usuário
  canEditUser(currentUserId: string, targetUserId: string, targetUserRole: string): boolean {
    // Usuário de gestão não pode alterar seu próprio nível de acesso
    if (currentUserId === targetUserId && isManagerLikeRole(targetUserRole)) {
      return false;
    }
    return true;
  }

  // Verificar se email está disponível
  async checkEmailAvailability(email: string): Promise<{ available: boolean; error?: string }> {
    const url = `${API_CLIENT_BASE}/manager/${this.supabaseId}/users?email=${encodeURIComponent(email)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": this.supabaseId,
        ...(this.teamId ? { "x-team-id": this.teamId } : {}),
      },
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.isValid) {
      return {
        available: false,
        error: payload?.errorMessages?.join(", ") || `HTTP error! status: ${response.status}`,
      };
    }

    return {
      available: payload?.result?.available === true,
    };
  }

  // Buscar times do usuário (exceto o time ativo)
  async getUserTeams(userId: string): Promise<ManagerUserTeamsApiResponse> {
    return this.makeRequest<ManagerUserTeamsApiResponse>(`/${this.supabaseId}/users/${userId}/teams`);
  }

  /** Situação de acesso de cada usuário do time ativo (coluna "Acesso"). */
  async getAccessSummary(): Promise<TeamMemberAccessSummary[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}${API_CLIENT_BASE}/manager/${this.supabaseId}/users/access-summary`,
        {
          headers: {
            'x-supabase-user-id': this.supabaseId,
            ...(this.teamId ? { 'x-team-id': this.teamId } : {}),
          },
          cache: 'no-store',
        }
      );
      const body = await response.json();
      return body?.isValid && Array.isArray(body.result) ? body.result : [];
    } catch (error) {
      // A coluna é informativa: sem resumo, a tabela segue funcionando.
      console.error('Erro ao carregar situação de acesso:', error);
      return [];
    }
  }

  /** Último acesso e e-mails de acesso enviados ao usuário. */
  async getAccessHistory(userId: string): Promise<{ isValid: boolean; errorMessages: string[]; result: TeamMemberAccessHistory | null }> {
    try {
      const response = await fetch(
        `${this.baseUrl}${API_CLIENT_BASE}/manager/${this.supabaseId}/users/${encodeURIComponent(userId)}/access-history`,
        {
          headers: {
            'x-supabase-user-id': this.supabaseId,
            ...(this.teamId ? { 'x-team-id': this.teamId } : {}),
          },
          cache: 'no-store',
        }
      );
      return await response.json();
    } catch (error) {
      console.error('Erro ao carregar histórico de acesso:', error);
      return { isValid: false, errorMessages: ['Não foi possível carregar o histórico de acesso.'], result: null };
    }
  }

  /**
   * Reenvia o e-mail de acesso do usuário: primeiro acesso para quem ainda não entrou, nova senha
   * para quem já entrou. O servidor confere se quem pede é master/manager do time do usuário.
   */
  async resendAccessEmail(userId: string): Promise<{ isValid: boolean; successMessages: string[]; errorMessages: string[] }> {
    try {
      const response = await fetch(
        `${this.baseUrl}${API_CLIENT_BASE}/manager/${this.supabaseId}/users/${encodeURIComponent(userId)}/access-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-supabase-user-id': this.supabaseId,
            ...(this.teamId ? { 'x-team-id': this.teamId } : {}),
          },
        }
      );
      return await response.json();
    } catch (error) {
      console.error('Erro ao reenviar e-mail de acesso:', error);
      return {
        isValid: false,
        successMessages: [],
        errorMessages: ['Não foi possível reenviar o e-mail de acesso. Tente novamente.'],
      };
    }
  }
}

export { ManagerUsersService };
