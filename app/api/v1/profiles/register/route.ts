import { Output } from "@/lib/output";
import { NextRequest, NextResponse } from "next/server";
import { RequestToRegisterUserProfile } from "./DTO/requestToRegisterUserProfile";

export async function POST(req: NextRequest) {
    try {
        const data: RequestToRegisterUserProfile = await req.json();
        const output = 

    } catch (error) {
        console.error("Error creating teacher:", error);
        return NextResponse.json(
        { errors: new Output(false, [], ["Failed to create teacher"], null) },
        { status: 500 },
        );
    }
}