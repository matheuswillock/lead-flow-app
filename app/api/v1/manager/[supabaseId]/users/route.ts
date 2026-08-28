import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import {
  CreateUserSchema,
  UpdateUserSchema,
  AssociateOperatorSchema,
  DissociateOperatorSchema,
} from "./types";
import {
  getTeamAccess,
  hasDelegatedUserCreationAccess,
} from "@/app/api/v1/utils/teamAccess";
import { isManagerLikeRole } from "@/lib/roles";
import { managerAccountUsersUseCase } from "@/app/api/useCases/managerAccountUsers/ManagerAccountUsersUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

/**
 * POST /api/v1/manager/[supabaseId]/users
 * Cria um novo manager ou operator no time ativo
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const requesterId = request.headers.get("x-supabase-user-id");
    const { supabaseId } = await params;

    if (!requesterId) {
      const output = new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    if (requesterId !== supabaseId) {
      const output = new Output(false, [], ["Você só pode gerenciar seus próprios recursos"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId, profileId, teamMember, isMaster, managerId } = teamAccess.access;
    if (!isManagerLikeRole(teamMember.role)) {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    if (!hasDelegatedUserCreationAccess(teamAccess.access)) {
      const output = new Output(
        false,
        [],
        ["Apenas o master ou um manager delegado pode adicionar usuários da conta"],
        null
      );
      return NextResponse.json(output, { status: 403 });
    }

    const body = await request.json();

    let validatedData;
    try {
      validatedData = CreateUserSchema.parse(body);
    } catch (validationError: any) {
      const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
      const output = new Output(false, [], errors, null);
      return NextResponse.json(output, { status: 400 });
    }

    const { output, status } = await managerAccountUsersUseCase.createAccountUser({
      ctx: { teamId, profileId, managerId, isMaster },
      userData: validatedData,
    });

    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[ManagerUsersRoute][POST] Erro ao criar usuário:", {
      error: error instanceof Error ? { message: error.message, stack: error.stack, name: error.name } : error,
    });
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * GET /api/v1/manager/[supabaseId]/users?role=MANAGER|OPERATOR
 * Lista usuários do time ativo
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  await connection();

  try {
    const requesterId = request.headers.get("x-supabase-user-id");
    const { supabaseId } = await params;
    const { searchParams } = new URL(request.url);
    const emailToCheck = searchParams.get("email");

    if (!requesterId) {
      const output = new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    if (requesterId !== supabaseId) {
      const output = new Output(false, [], ["Você só pode acessar seus próprios recursos"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId, profileId, teamMember, isMaster, managerId } = teamAccess.access;
    if (!isManagerLikeRole(teamMember.role)) {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    if (emailToCheck) {
      const { output, status } = await managerAccountUsersUseCase.checkEmailAvailability(emailToCheck);
      return NextResponse.json(output, { status });
    }

    const { output, stats, status } = await managerAccountUsersUseCase.listAccountUsers({
      ctx: { teamId, profileId, managerId, isMaster },
      canListPendingUsers: isMaster || hasDelegatedUserCreationAccess(teamAccess.access),
    });

    const responseWithStats = {
      ...output,
      stats,
    };

    return NextResponse.json(responseWithStats, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Erro ao listar usuários:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * PUT /api/v1/manager/[supabaseId]/users
 * Atualiza usuário ou associa/desassocia membro do time
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const requesterId = request.headers.get("x-supabase-user-id");
    const { supabaseId } = await params;

    if (!requesterId) {
      const output = new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    if (requesterId !== supabaseId) {
      const output = new Output(false, [], ["Você só pode gerenciar seus próprios recursos"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId, profileId, teamMember, isMaster, managerId } = teamAccess.access;
    if (!isManagerLikeRole(teamMember.role)) {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;
    const ctx = { teamId, profileId, managerId, isMaster };

    if (action === "associate") {
      let validatedData;
      try {
        validatedData = AssociateOperatorSchema.parse(body);
      } catch (validationError: any) {
        const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
        const output = new Output(false, [], errors, null);
        return NextResponse.json(output, { status: 400 });
      }

      const { output, status } = await managerAccountUsersUseCase.associateTeamMember({
        ctx,
        userData: validatedData,
      });

      return NextResponse.json(output, { status });
    }

    if (action === "dissociate") {
      let validatedData;
      try {
        validatedData = DissociateOperatorSchema.parse(body);
      } catch (validationError: any) {
        const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
        const output = new Output(false, [], errors, null);
        return NextResponse.json(output, { status: 400 });
      }

      const { output, status } = await managerAccountUsersUseCase.dissociateTeamMember({
        ctx,
        userData: validatedData,
      });

      return NextResponse.json(output, { status });
    }

    let validatedData;
    try {
      validatedData = UpdateUserSchema.parse(body);
    } catch (validationError: any) {
      const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
      const output = new Output(false, [], errors, null);
      return NextResponse.json(output, { status: 400 });
    }

    const { output, status } = await managerAccountUsersUseCase.updateAccountUser({
      ctx,
      userData: validatedData,
    });

    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Erro ao gerenciar usuário:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * DELETE /api/v1/manager/[supabaseId]/users?userId=xxx
 * Remove um usuário do time ativo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const requesterId = request.headers.get("x-supabase-user-id");
    const { supabaseId } = await params;

    let userId: string | null = null;
    try {
      const body = await request.json();
      userId = body.userId;
    } catch {
      const { searchParams } = new URL(request.url);
      userId = searchParams.get("userId");
    }

    if (!requesterId) {
      const output = new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    if (requesterId !== supabaseId) {
      const output = new Output(false, [], ["Você só pode gerenciar seus próprios recursos"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId, profileId, teamMember, isMaster, managerId } = teamAccess.access;
    if (!isManagerLikeRole(teamMember.role)) {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    if (!isMaster) {
      const output = new Output(false, [], ["Apenas o master do time pode remover usuários"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const { output, status } = await managerAccountUsersUseCase.removeAccountUser({
      ctx: { teamId, profileId, managerId, isMaster },
      userId,
    });

    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Erro ao excluir usuário:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
