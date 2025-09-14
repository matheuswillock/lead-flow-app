import { Output } from "@/lib/output";
import { RequestToRegisterUserProfile } from "../../v1/profiles/register/DTO/requestToRegisterUserProfile";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository";
import { UserRole } from "@prisma/client";
import type { IProfileUseCase } from "./IProfileUseCase";

export class RegisterNewUserProfile implements IProfileUseCase {
    constructor(private readonly repo: IProfileRepository = profileRepository) {}

    async registerUserProfile(input: RequestToRegisterUserProfile): Promise<Output> {
        try {
            if (!input || !input.fullname || !input.email || !input.phone || !input.password) {
                return new Output(false, [], ["Invalid input data"], {
                    fullName: !input?.fullname ? "Full name is required" : undefined,
                    email: !input?.email ? "Email is required" : undefined,
                    phone: !input?.phone ? "Phone number is required" : undefined,
                    password: !input?.password ? "Password is required" : undefined,
                });
            }

            const alreadyExists = await this.repo.existingByEmailOrPhone(input.email, input.phone);
            if (alreadyExists) {
                return new Output(false, [], ["User already exists with the same email or phone"], null);
            }

            const profileId = await this.repo.createProfile(
                input.fullname,
                input.phone,
                input.password,
                input.email,
                UserRole.manager,
            );

            if (!profileId) {
                return new Output(false, [], ["Failed to create user profile"], null);
            }

            return new Output(true, ["User profile registered successfully"], [], { profileId });
        } catch (error) {
            console.error("Error registering user profile:", error);
            return new Output(false, [], ["Failed to register user profile"], null);
        }
    }
}
