import { RequestToRegisterUserProfile } from "@/app/api/v1/profiles/register/DTO/requestToRegisterUserProfile";
import { Output } from "@/lib/output";
import { ISignUpService } from "./ISignUpService";

/**
 * Implementação concreta do serviço de cadastro de usuários
 * Implementa ISignUpService seguindo os princípios SOLID
 */
export class SignUpService implements ISignUpService {
  /**
   * Registra um novo usuário através da API
   * @param requestData - Dados do usuário para registro
   * @returns Promise com o resultado da operação
   */
  async registerUser(requestData: RequestToRegisterUserProfile): Promise<Output> {
    try {
      const response = await fetch("/api/v1/profiles/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const result: { output?: Output; errors?: Output } = await response.json();

      if (!response.ok) {
        // Em caso de erro HTTP, retornar o output de erro se disponível
        if (result.errors) {
          return result.errors;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Em caso de sucesso, retornar o output
      return result.output || new Output(false, [], ["Resposta inválida da API"], null);
    } catch (error) {
      console.error("Error on SignUp:", error);
      
      // Retorna um Output com erro em caso de falha na requisição
      return new Output(
        false,
        [],
        ["Erro de conexão. Verifique sua internet e tente novamente."],
        null
      );
    }
  }
}

/**
 * Factory function para criar uma instância do serviço
 * Facilita a injeção de dependência e testes
 */
export const createSignUpService = (): ISignUpService => {
  return new SignUpService();
};

// Mantém a função original para compatibilidade (deprecated)
// TODO: Remover após migração completa para o novo padrão
export const HandleSignUp = async (requestData: RequestToRegisterUserProfile) => {
  const service = createSignUpService();
  const result = await service.registerUser(requestData);
  
  if (!result || !result.isValid) {
    console.error("Invalid response or data not valid:", result);
    return null;
  }

  return result.result;
};