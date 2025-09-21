import { 
  ManagerUser, 
  CreateManagerUserFormData, 
  UpdateManagerUserFormData,
  ManagerUsersApiResponse,
  ManagerUserApiResponse 
} from "../types";

class ManagerUsersService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1/manager${endpoint}`;
    
    const defaultHeaders = {
      "Content-Type": "application/json",
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
  async getUsers(supabaseId: string): Promise<ManagerUsersApiResponse> {
    return this.makeRequest<ManagerUsersApiResponse>(`/${supabaseId}/users`);
  }

  // Criar novo usuário
  async createUser(
    supabaseId: string, 
    userData: CreateManagerUserFormData
  ): Promise<ManagerUserApiResponse> {
    return this.makeRequest<ManagerUserApiResponse>(`/${supabaseId}/users`, {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  // Atualizar usuário existente
  async updateUser(
    supabaseId: string,
    userId: string,
    userData: UpdateManagerUserFormData
  ): Promise<ManagerUserApiResponse> {
    return this.makeRequest<ManagerUserApiResponse>(`/${supabaseId}/users`, {
      method: "PUT",
      body: JSON.stringify({
        id: userId,
        ...userData,
      }),
    });
  }

  // Deletar usuário
  async deleteUser(
    supabaseId: string,
    userId: string
  ): Promise<ManagerUserApiResponse> {
    return this.makeRequest<ManagerUserApiResponse>(`/${supabaseId}/users`, {
      method: "DELETE",
      body: JSON.stringify({ id: userId }),
    });
  }

  // Buscar contagem de leads por usuário (simulado por enquanto)
  async getUserLeadsCount(userId: string): Promise<number> {
    // TODO: Implementar endpoint real quando disponível
    // Por enquanto retorna um número aleatório para demonstração
    return Math.floor(Math.random() * 50);
  }

  // Verificar se usuário pode ser deletado
  async canDeleteUser(supabaseId: string, userId: string): Promise<boolean> {
    try {
      const response = await this.getUsers(supabaseId);
      if (!response.isValid || !response.result) {
        return false;
      }

      const users = response.result;
      const user = users.find(u => u.id === userId);
      
      if (!user) return false;

      // Manager não pode deletar a si mesmo
      if (user.id === supabaseId) return false;

      // Verificar se é o único manager
      if (user.role === "manager") {
        const managerCount = users.filter(u => u.role === "manager").length;
        return managerCount > 1;
      }

      return true;
    } catch (error) {
      console.error("Erro ao verificar se usuário pode ser deletado:", error);
      return false;
    }
  }

  // Verificar se usuário pode editar outro usuário
  canEditUser(currentUserId: string, targetUserId: string, targetUserRole: string): boolean {
    // Manager não pode alterar seu próprio papel
    if (currentUserId === targetUserId && targetUserRole === "manager") {
      return false;
    }
    return true;
  }
}

export const managerUsersService = new ManagerUsersService();