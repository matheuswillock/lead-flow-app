import type { Output } from "@/lib/output";
import type { RequestToRegisterUserProfile } from "../../v1/profiles/register/DTO/requestToRegisterUserProfile";

export interface IProfileUseCase {
  registerUserProfile(input: RequestToRegisterUserProfile): Promise<Output>;
}
