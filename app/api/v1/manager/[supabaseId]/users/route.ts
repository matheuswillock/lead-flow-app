import { NextRequest, NextResponse } from "next/server";
import { ManagerUserRepository } from "../../../../infra/data/repositories/managerUser/ManagerUserRepository";
import { ManagerUserUseCase } from "../../../../useCases/managerUser/ManagerUserUseCase";
import { RegisterNewUserProfile } from "../../../../useCases/profiles/ProfileUseCase";
import { Output } from "@/lib/output";
import { 
  CreateUserSchema, 
  AssociateOperatorSchema, 
  DissociateOperatorSchema 
} from "./types";

// Instâncias dos casos de uso
const managerUserRepository = new ManagerUserRepository();
const profileUseCase = new RegisterNewUserProfile();
const managerUserUseCase = new ManagerUserUseCase(managerUserRepository);

/**
 * POST /api/v1/manager/[supabaseId]/users
 * Cria um novo manager ou operator
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const body = await request.json();
    const requesterId = request.headers.get('x-supabase-user-id');
    const { supabaseId } = await params;
    
    if (!requesterId) {
      const output = new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    // Verificar se o usuário atual é um manager e se está acessando seus próprios recursos
    const requesterProfile = await profileUseCase.getProfileInfoBySupabaseId(requesterId);
    if (!requesterProfile || requesterProfile.role !== 'manager') {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    if (requesterId !== supabaseId) {
      const output = new Output(false, [], ["Você só pode gerenciar seus próprios recursos"], null);
      return NextResponse.json(output, { status: 403 });
    }

    // Validar dados de entrada
    let validatedData;
    try {
      validatedData = CreateUserSchema.parse(body);
    } catch (validationError: any) {
      const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
      const output = new Output(false, [], errors, null);
      return NextResponse.json(output, { status: 400 });
    }

    const { role } = validatedData;

    if (role === 'manager') {
      const output = await managerUserUseCase.createManager({
        fullName: validatedData.name,
        email: validatedData.email
      });
      const status = output.isValid ? 200 : 400;
      return NextResponse.json(output, { status });
    } else if (role === 'operator') {
      // For operator creation, we need managerId from the requester
      const output = await managerUserUseCase.createOperator({
        fullName: validatedData.name,
        email: validatedData.email,
        managerId: requesterProfile.id // Use the manager who is creating the operator
      });
      const status = output.isValid ? 200 : 400;
      return NextResponse.json(output, { status });
    } else {
      const output = new Output(false, [], ["Role deve ser 'manager' ou 'operator'"], null);
      return NextResponse.json(output, { status: 400 });
    }

  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * GET /api/v1/manager/[supabaseId]/users?role=MANAGER|OPERATOR
 * Lista todos os usuários ou filtra por role
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const requesterId = request.headers.get('x-supabase-user-id');
    const { supabaseId } = await params;
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role');
    
    if (!requesterId) {
      const output = new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    // Verificar se o usuário atual é um manager
    const requesterProfile = await profileUseCase.getProfileInfoBySupabaseId(requesterId);
    if (!requesterProfile || requesterProfile.role !== 'manager') {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    if (requesterId !== supabaseId) {
      const output = new Output(false, [], ["Você só pode acessar seus próprios recursos"], null);
      return NextResponse.json(output, { status: 403 });
    }

    // Listar usuários com filtro opcional por role
    if (roleFilter === 'manager') {
      // Return empty for now - would need getAllManagers implementation
      const output = new Output(true, [], [], []);
      return NextResponse.json(output, { status: 200 });
    } else if (roleFilter === 'operator') {
      // Get operators managed by this manager
      const operators = await managerUserRepository.getOperatorsByManager(requesterProfile.id);
      const output = new Output(true, [], [], operators);
      return NextResponse.json(output, { status: 200 });
    } else {
      // Return operators for this manager (we could expand this to include all users)
      const operators = await managerUserRepository.getOperatorsByManager(requesterProfile.id);
      const output = new Output(true, [], [], operators);
      return NextResponse.json(output, { status: 200 });
    }

  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * PUT /api/v1/manager/[supabaseId]/users
 * Associa ou desassocia operator de manager
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const body = await request.json();
    const requesterId = request.headers.get('x-supabase-user-id');
    const { supabaseId } = await params;
    
    if (!requesterId) {
      const output = new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    // Verificar se o usuário atual é um manager
    const requesterProfile = await profileUseCase.getProfileInfoBySupabaseId(requesterId);
    if (!requesterProfile || requesterProfile.role !== 'manager') {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    if (requesterId !== supabaseId) {
      const output = new Output(false, [], ["Você só pode gerenciar seus próprios recursos"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const { action } = body;

    if (action === 'associate') {
      // Validar dados para associação
      let validatedData;
      try {
        validatedData = AssociateOperatorSchema.parse(body);
      } catch (validationError: any) {
        const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
        const output = new Output(false, [], errors, null);
        return NextResponse.json(output, { status: 400 });
      }

      const output = await managerUserUseCase.associateOperatorToManager(
        validatedData.managerId, 
        validatedData.operatorId
      );
      return NextResponse.json(output, { status: output.isValid ? 200 : 400 });

    } else if (action === 'dissociate') {
      // Validar dados para dissociação
      let validatedData;
      try {
        validatedData = DissociateOperatorSchema.parse(body);
      } catch (validationError: any) {
        const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
        const output = new Output(false, [], errors, null);
        return NextResponse.json(output, { status: 400 });
      }

      // Note: dissociateOperatorFromManager needs managerId and operatorId
      // We'll need the managerId from the requester profile
      const output = await managerUserUseCase.dissociateOperatorFromManager(
        requesterProfile.id,
        validatedData.operatorId
      );
      return NextResponse.json(output, { status: output.isValid ? 200 : 400 });

    } else {
      const output = new Output(false, [], ["Ação deve ser 'associate' ou 'dissociate'"], null);
      return NextResponse.json(output, { status: 400 });
    }

  } catch (error) {
    console.error("Erro ao gerenciar associação:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * DELETE /api/v1/manager/[supabaseId]/users?userId=xxx
 * Exclui um manager ou operator
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const requesterId = request.headers.get('x-supabase-user-id');
    const { supabaseId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!requesterId) {
      const output = new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    // Verificar se o usuário atual é um manager
    const requesterProfile = await profileUseCase.getProfileInfoBySupabaseId(requesterId);
    if (!requesterProfile || requesterProfile.role !== 'manager') {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    if (requesterId !== supabaseId) {
      const output = new Output(false, [], ["Você só pode gerenciar seus próprios recursos"], null);
      return NextResponse.json(output, { status: 403 });
    }

    if (!userId) {
      const output = new Output(false, [], ["Parâmetro userId é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    // Verificar se não está tentando excluir a si mesmo
    if (userId === requesterProfile.id) {
      const output = new Output(false, [], ["Você não pode excluir a si mesmo"], null);
      return NextResponse.json(output, { status: 400 });
    }

    // Tentar deletar como manager primeiro, se falhar, tentar como operator
    let output = await managerUserUseCase.deleteManager(userId);
    
    if (!output.isValid) {
      // Se falhou como manager, tentar como operator
      output = await managerUserUseCase.deleteOperator(userId);
    }

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });

  } catch (error) {
    console.error("Erro ao excluir usuário:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}