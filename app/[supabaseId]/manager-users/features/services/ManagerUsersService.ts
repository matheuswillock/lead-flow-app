import { 
  CreateManagerUserFormData, 
  UpdateManagerUserFormData,
  ManagerUsersApiResponse,
  ManagerUserApiResponse,
  ManagerUserTeamsApiResponse
} from "../types";
import { isManagerLikeRole } from "@/lib/roles";

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
    const url = `${this.baseUrl}/api/v1/manager${endpoint}`;
    
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
    // Usuário de gestão não pode alterar seu próprio papel
    if (currentUserId === targetUserId && isManagerLikeRole(targetUserRole)) {
      return false;
    }
    return true;
  }

  // Verificar se email está disponível
  async checkEmailAvailability(email: string): Promise<{ available: boolean; error?: string }> {
    const url = `/api/v1/manager/${this.supabaseId}/users?email=${encodeURIComponent(email)}`;
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

  // Reenviar convite por e-mail para operador
  async resendInvite(email: string, userId?: string): Promise<{ isValid: boolean; successMessages: string[]; errorMessages: string[] }> {
    try {
      const response = await fetch('/api/v1/operators/resend-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, userId }),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Erro ao reenviar convite:', error);
      return {
        isValid: false,
        successMessages: [],
        errorMessages: ['Erro ao reenviar convite'],
      };
    }
  }
}

export { ManagerUsersService };
