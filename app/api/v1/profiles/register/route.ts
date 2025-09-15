import { Output } from "@/lib/output";
import { NextRequest, NextResponse } from "next/server";
import { RequestToRegisterUserProfile, validateRegisterProfileRequest } from "../DTO/requestToRegisterUserProfile";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import type { IProfileUseCase } from "@/app/api/useCases/profiles/IProfileUseCase";

const useCase: IProfileUseCase = new RegisterNewUserProfile();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        let validatedData: RequestToRegisterUserProfile;
        try {
            validatedData = validateRegisterProfileRequest(body);
        } catch (validationError) {
            const output = new Output(false, [], [(validationError as Error).message], null);
            return NextResponse.json(output, { status: 400 });
        }

        const output = await useCase.registerUserProfile(validatedData);
        const status = output.isValid ? 201 : 400;
        return NextResponse.json(output, { status });
    } catch (error) {
        console.error("Error creating user profile:", error);
        const output = new Output(false, [], ["Failed to create user profile"], null);
        return NextResponse.json(output, { status: 500 });
    }
}