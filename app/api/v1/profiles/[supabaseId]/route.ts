import { NextRequest, NextResponse } from "next/server";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import { validateUpdateProfileRequest } from "../DTO/requestToUpdateProfile";
import { Output } from "@/lib/output";

const profileUseCase = new RegisterNewUserProfile();

/**
 * GET /api/v1/profiles/[supabaseId]
 * Busca os dados do profile por supabaseId
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const { supabaseId } = await params;

    if (!supabaseId) {
      const output = new Output(false, [], ["Supabase ID is required"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const result = await profileUseCase.getProfileBySupabaseId(supabaseId);

    if (!result.isValid) {
      return NextResponse.json(result, { 
        status: result.errorMessages.includes("Profile not found") ? 404 : 400 
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/v1/profiles/[supabaseId]:", error);
    const output = new Output(false, [], ["Internal server error"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * PUT /api/v1/profiles/[supabaseId]
 * Atualiza os dados do profile
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
    
    let updateData;
    try {
      updateData = validateUpdateProfileRequest(body);
    } catch (validationError) {
      const output = new Output(false, [], [(validationError as Error).message], null);
      return NextResponse.json(output, { status: 400 });
    }

    const result = await profileUseCase.updateProfile(supabaseId, updateData);

    if (!result.isValid) {
      return NextResponse.json(result, { 
        status: result.errorMessages.includes("Profile not found") ? 404 : 400 
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error in PUT /api/v1/profiles/[supabaseId]:", error);
    const output = new Output(false, [], ["Internal server error"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * DELETE /api/v1/profiles/[supabaseId]
 * Deleta o profile e a autenticação do Supabase
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const { supabaseId } = await params;

    if (!supabaseId) {
      const output = new Output(false, [], ["Supabase ID is required"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const result = await profileUseCase.deleteProfile(supabaseId);

    if (!result.isValid) {
      return NextResponse.json(result, { 
        status: result.errorMessages.includes("Profile not found") ? 404 : 400 
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error in DELETE /api/v1/profiles/[supabaseId]:", error);
    const output = new Output(false, [], ["Internal server error"], null);
    return NextResponse.json(output, { status: 500 });
  }
}