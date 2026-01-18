import { NextRequest, NextResponse } from "next/server";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import { Output } from "@/lib/output";
import { profileIconService } from "@/app/api/services/profile/ProfileIconService";

const profileUseCase = new RegisterNewUserProfile();

/**
 * POST /api/v1/profiles/[supabaseId]/icon
 * Upload de ícone de perfil
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const { supabaseId } = await params;

    if (!supabaseId) {
      const output = new Output(false, [], ["Supabase ID is required"], null);
      return NextResponse.json(output, { status: 400 });
    }

    // Verificar se o perfil existe
    const existingProfile = await profileUseCase.getProfileBySupabaseId(supabaseId);
    if (!existingProfile.isValid) {
      return NextResponse.json(existingProfile, { 
        status: existingProfile.errorMessages.includes("Profile not found") ? 404 : 400 
      });
    }

    // Obter arquivo do FormData
    const formData = await request.formData();
    const file = formData.get('icon') as File;

    if (!file) {
      const output = new Output(false, [], ["No file provided"], null);
      return NextResponse.json(output, { status: 400 });
    }

    // Fazer upload do arquivo
    const uploadResult = await profileIconService.uploadProfileIcon(file, supabaseId);

    if (!uploadResult.success) {
      // Retornar erro já mapeado do service
      const output = new Output(
        false, 
        [], 
        [uploadResult.error || "Erro ao fazer upload da imagem"], 
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    // Atualizar o perfil com o novo iconId e iconUrl
    const updateResult = await profileUseCase.updateProfileIcon(supabaseId, uploadResult.iconId!, uploadResult.publicUrl!);

    if (!updateResult.isValid) {
      // Se falhou ao atualizar o banco, tentar remover o arquivo enviado
      if (uploadResult.iconId) {
        await profileIconService.deleteProfileIcon(uploadResult.iconId);
      }
      return NextResponse.json(updateResult, { status: 400 });
    }

    const output = new Output(true, ["Ícone de perfil atualizado com sucesso"], [], {
      iconId: uploadResult.iconId,
      publicUrl: uploadResult.publicUrl
    });

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("Error in POST /api/v1/profiles/[supabaseId]/icon:", error);
    const output = new Output(
      false, 
      [], 
      ["Erro inesperado ao fazer upload da imagem. Tente novamente"], 
      null
    );
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * DELETE /api/v1/profiles/[supabaseId]/icon
 * Remove ícone de perfil
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

    // Verificar se o perfil existe e obter o iconId atual
    const existingProfile = await profileUseCase.getProfileBySupabaseId(supabaseId);
    if (!existingProfile.isValid) {
      return NextResponse.json(existingProfile, { 
        status: existingProfile.errorMessages.includes("Profile not found") ? 404 : 400 
      });
    }

    const profile = existingProfile.result;
    if (!profile?.profileIconId) {
      const output = new Output(false, [], ["No profile icon to delete"], null);
      return NextResponse.json(output, { status: 400 });
    }

    // Remover arquivo do storage
    const deleteResult = await profileIconService.deleteProfileIcon(profile.profileIconId);

    if (!deleteResult.success) {
      // Retornar erro já mapeado do service
      const output = new Output(
        false, 
        [], 
        [deleteResult.error || "Erro ao deletar a imagem"], 
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    // Atualizar o perfil removendo o iconId e iconUrl
    const updateResult = await profileUseCase.updateProfileIcon(supabaseId, null, null);

    if (!updateResult.isValid) {
      return NextResponse.json(updateResult, { status: 400 });
    }

    const output = new Output(true, ["Ícone de perfil removido com sucesso"], [], null);
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("Error in DELETE /api/v1/profiles/[supabaseId]/icon:", error);
    const output = new Output(
      false, 
      [], 
      ["Erro inesperado ao deletar a imagem. Tente novamente"], 
      null
    );
    return NextResponse.json(output, { status: 500 });
  }
}