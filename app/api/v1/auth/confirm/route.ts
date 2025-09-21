import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";

/**
 * GET /api/v1/auth/confirm?token=...
 * Confirma a conta do usuário usando o token enviado por email
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    if (!token) {
      const output = new Output(false, [], ["Token de confirmação é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    // Buscar usuário pelo token
    const profile = await profileRepository.findByConfirmationToken(token);
    
    if (!profile) {
      const output = new Output(false, [], ["Token inválido ou expirado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    // Verificar se o token não expirou
    if (profile.confirmationTokenExp && new Date() > profile.confirmationTokenExp) {
      const output = new Output(false, [], ["Token expirado"], null);
      return NextResponse.json(output, { status: 410 });
    }

    // Verificar se a conta já foi confirmada
    if (profile.isConfirmed) {
      const output = new Output(false, [], ["Conta já foi confirmada"], null);
      return NextResponse.json(output, { status: 409 });
    }

    // Retornar os dados do usuário para preenchimento do formulário
    const result = {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      token: token
    };

    const output = new Output(true, ["Token válido"], [], result);
    return NextResponse.json(output, { status: 200 });

  } catch (error) {
    console.error("Erro ao confirmar token:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * POST /api/v1/auth/confirm
 * Completa a ativação da conta com senha e dados finais
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password, fullName, phone } = body;
    
    if (!token || !password) {
      const output = new Output(false, [], ["Token e senha são obrigatórios"], null);
      return NextResponse.json(output, { status: 400 });
    }

    // Validar senha
    if (password.length < 6) {
      const output = new Output(false, [], ["Senha deve ter pelo menos 6 caracteres"], null);
      return NextResponse.json(output, { status: 400 });
    }

    // Buscar usuário pelo token
    const profile = await profileRepository.findByConfirmationToken(token);
    
    if (!profile) {
      const output = new Output(false, [], ["Token inválido ou expirado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    // Verificar se o token não expirou
    if (profile.confirmationTokenExp && new Date() > profile.confirmationTokenExp) {
      const output = new Output(false, [], ["Token expirado"], null);
      return NextResponse.json(output, { status: 410 });
    }

    // Verificar se a conta já foi confirmada
    if (profile.isConfirmed) {
      const output = new Output(false, [], ["Conta já foi confirmada"], null);
      return NextResponse.json(output, { status: 409 });
    }

    // Confirmar a conta no banco e criar usuário no Supabase Auth
    const success = await profileRepository.confirmAccount(profile.id, {
      password,
      fullName: fullName || profile.fullName,
      phone: phone || null
    });

    if (!success) {
      const output = new Output(false, [], ["Erro ao ativar conta"], null);
      return NextResponse.json(output, { status: 500 });
    }

    const output = new Output(true, ["Conta ativada com sucesso!"], [], null);
    return NextResponse.json(output, { status: 200 });

  } catch (error) {
    console.error("Erro ao ativar conta:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}