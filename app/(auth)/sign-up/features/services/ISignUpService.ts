import { RequestToRegisterUserProfile, RequestToRegisterUserProfileOAuth } from "@/app/api/v1/profiles/DTO/requestToRegisterUserProfile";
import { Output } from "@/lib/output";

/**
 * Interface para o serviço de cadastro de usuários
 * Seguindo o princípio de Dependency Inversion (SOLID)
 */
export interface ISignUpService {
  /**
   * Registra um novo usuário
   * @param requestData - Dados do usuário para registro
   * @returns Promise com o resultado da operação
   */
  registerUser(requestData: RequestToRegisterUserProfile): Promise<Output>;
  registerUserOAuth(requestData: RequestToRegisterUserProfileOAuth, supabaseId: string): Promise<Output>;
}
