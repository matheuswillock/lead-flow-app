import { Output } from "@/lib/output";
import { RequestToRegisterUserProfile } from "../v1/profiles/register/DTO/requestToRegisterUserProfile";

export const RegisterNewUserProfileUseCase: (
    input: RequestToRegisterUserProfile
) => Promise<Output> = async (input: RequestToRegisterUserProfile) => {
    try {
        if (!input || !input.fullname || !input.email || !input.phone) {
            return new Output(false, [], ["Invalid input data"], {
                fullName: "Full name is required",
                email: "Email is required",
                phone: "Phone number is required",
            });
        }

        // TODO - Implement the actual registration logic here
        console.log("Registering new user profile:", input);
        return new Output(true, [], ["User profile registered successfully"], null);
    } catch (error) {
        console.error("Error registering user profile:", error);
        return new Output(false, [], ["Failed to register user profile"], null);
    }
}