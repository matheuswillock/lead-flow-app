import { Output } from "@/lib/output";
import { NextRequest, NextResponse } from "next/server";
import { RequestToRegisterUserProfile } from "./DTO/requestToRegisterUserProfile";
import { RegisterNewUserProfile } from "@/app/api/useCase/profiles/ProfileUseCase";
import type { IProfileUseCase } from "@/app/api/useCase/profiles/IProfileUseCase";

const useCase: IProfileUseCase = new RegisterNewUserProfile();

export async function POST(req: NextRequest) {
    try {
        const data: RequestToRegisterUserProfile = await req.json();
        const output = await useCase.registerUserProfile(data);
        const status = output.isValid ? 201 : 400;
        return NextResponse.json({ output }, { status });
    } catch (error) {
        console.error("Error creating user profile:", error);
        return NextResponse.json(
        { errors: new Output(false, [], ["Failed to create user profile"], null) },
        { status: 500 },
        );
    }
}