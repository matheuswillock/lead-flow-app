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
      let validatedCore: RequestToRegisterUserProfile;
      try {
        // Valida apenas os campos obrigatórios e básicos
        validatedCore = validateRegisterProfileRequest(requestData);
      } catch (validationError) {
        return new Output(false, [], [(validationError as Error).message], null);
      }

      // Recompõe o payload incluindo os campos opcionais de assinatura/endereço
      const payload: RequestToRegisterUserProfile = {
        ...validatedCore,
        asaasCustomerId: (requestData as any).asaasCustomerId,
        subscriptionId: (requestData as any).subscriptionId,
        cpfCnpj: (requestData as any).cpfCnpj,
        subscriptionStatus: (requestData as any).subscriptionStatus,
        subscriptionPlan: (requestData as any).subscriptionPlan,
        role: (requestData as any).role,
        operatorCount: (requestData as any).operatorCount,
        subscriptionStartDate: (requestData as any).subscriptionStartDate,
        trialEndDate: (requestData as any).trialEndDate,
        postalCode: (requestData as any).postalCode,
        address: (requestData as any).address,
        addressNumber: (requestData as any).addressNumber,
        neighborhood: (requestData as any).neighborhood,
        complement: (requestData as any).complement,
        city: (requestData as any).city,
        state: (requestData as any).state,
      };

      const response = await fetch("/api/v1/profiles/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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

