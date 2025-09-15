import { NextRequest, NextResponse } from "next/server";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import { validateUpdatePasswordRequest } from "../../DTO/requestToUpdatePassword";
import { Output } from "@/lib/output";

const profileUseCase = new RegisterNewUserProfile();

/**
 * PUT /api/v1/profiles/[supabaseId]/password
 * Atualiza apenas a senha do usuário
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const { supabaseId } = await params;

    if (!supabaseId) {
      const output = new Output(false, [], ["Supabase ID is required"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const body = await request.json();
    
    let validatedData;
    try {
      validatedData = validateUpdatePasswordRequest(body);
    } catch (validationError) {
      const output = new Output(false, [], [(validationError as Error).message], null);
      return NextResponse.json(output, { status: 400 });
    }

    const result = await profileUseCase.updatePassword(supabaseId, validatedData.password);

    if (!result.isValid) {
      return NextResponse.json(result, { 
        status: result.errorMessages.includes("Profile not found") ? 404 : 400 
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error in PUT /api/v1/profiles/[supabaseId]/password:", error);
    const output = new Output(false, [], ["Internal server error"], null);
    return NextResponse.json(output, { status: 500 });
  }
}