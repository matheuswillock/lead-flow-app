import { RequestToRegisterUserProfile, validateRegisterProfileRequest } from "@/app/api/v1/profiles/DTO/requestToRegisterUserProfile";
import { Output } from "@/lib/output";
import { ISignUpService } from "./ISignUpService";

export class SignUpService implements ISignUpService {
  /**
   * Registra um novo usuário através da API
   * @param requestData - Dados do usuário para registro
   * @returns Promise com o resultado da operação
   */
  async registerUser(requestData: RequestToRegisterUserProfile): Promise<Output> {
    try {
      let validatedData: RequestToRegisterUserProfile;
      try {
        validatedData = validateRegisterProfileRequest(requestData);
      } catch (validationError) {
        return new Output(false, [], [(validationError as Error).message], null);
      }

      const response = await fetch("/api/v1/profiles/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validatedData),
      });

      const result = await response.json();

      if (!response.ok) {
        return result;
      }

      return result;
    } catch (error) {
      console.error("Error on SignUp:", error);
      
      return new Output(
        false,
        [],
        ["Erro de conexão. Verifique sua internet e tente novamente."],
        null
      );
    }
  }
}


export const createSignUpService = (): ISignUpService => {
  return new SignUpService();
};

