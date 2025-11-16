import { 
  CreateManagerUserFormData, 
  UpdateManagerUserFormData,
  ManagerUsersApiResponse,
  ManagerUserApiResponse 
} from "../types";

class ManagerUsersService {
  private baseUrl: string;
  private supabaseId: string;

  constructor(supabaseId: string) {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
    this.supabaseId = supabaseId;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1/manager${endpoint}`;
    
    const defaultHeaders = {
      "Content-Type": "application/json",
      "x-supabase-user-id": this.supabaseId,
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

  // Buscar contagem de leads por usuário (simulado por enquanto)
  async getUserLeadsCount(): Promise<number> {
    // TODO: Implementar endpoint real quando disponível
    // Por enquanto retorna um número aleatório para demonstração
    return Math.floor(Math.random() * 50);
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
    // Manager não pode alterar seu próprio papel
    if (currentUserId === targetUserId && targetUserRole === "manager") {
      return false;
    }
    return true;
  }
}

export { ManagerUsersService };