import { NextRequest, NextResponse } from "next/server";
import { ManagerUserRepository } from "../../../../infra/data/repositories/managerUser/ManagerUserRepository";
import { ManagerUserUseCase } from "../../../../useCases/managerUser/ManagerUserUseCase";
import { RegisterNewUserProfile } from "../../../../useCases/profiles/ProfileUseCase";
import { Output } from "@/lib/output";
import { 
  CreateUserSchema,
  UpdateUserSchema, 
  AssociateOperatorSchema, 
  DissociateOperatorSchema 
} from "./types";
import { getEmailService } from "@/lib/services/EmailService";
import { LeadRepository } from "../../../../infra/data/repositories/lead/LeadRepository";
import { profileRepository } from "../../../../infra/data/repositories/profile/ProfileRepository";

const managerUserRepository = new ManagerUserRepository();
const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const managerUserUseCase = new ManagerUserUseCase(managerUserRepository, leadRepository, profileRepository);

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
      
      // Enviar email de boas-vindas se criação foi bem-sucedida
      if (output.isValid && output.result) {
        try {
          const emailService = getEmailService();
          await emailService.sendWelcomeEmail({
            userName: validatedData.name,
            userEmail: validatedData.email,
            loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-in`
          });
        } catch (emailError) {
          console.error("Erro ao enviar email de boas-vindas:", emailError);
          // Não falha a criação do usuário se o email falhar
        }
      }
      
      const status = output.isValid ? 200 : 400;
      return NextResponse.json(output, { status });
    } else if (role === 'operator') {
      // For operator creation, we need managerId from the requester
      const output = await managerUserUseCase.createOperator({
        fullName: validatedData.name,
        email: validatedData.email,
        managerId: requesterProfile.id // Use the manager who is creating the operator
      });
      
      // Enviar email de boas-vindas se criação foi bem-sucedida
      if (output.isValid && output.result) {
        try {
          const emailService = getEmailService();
          await emailService.sendWelcomeEmail({
            userName: validatedData.name,
            userEmail: validatedData.email,
            loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-in`
          });
        } catch (emailError) {
          console.error("Erro ao enviar email de boas-vindas:", emailError);
          // Não falha a criação do usuário se o email falhar
        }
      }
      
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
      // Para managers, retornar apenas outros managers (excluindo o próprio)
      // Por enquanto retornaremos vazio até definir a regra de negócio
      const output = new Output(true, [], [], []);
      return NextResponse.json(output, { status: 200 });
    } else if (roleFilter === 'operator') {
      // Get operators managed by this manager
      const operators = await managerUserRepository.getOperatorsByManager(requesterProfile.id);
      const output = new Output(true, [], [], operators);
      return NextResponse.json(output, { status: 200 });
    } else {
      // Return operators and pending operators with stats
      const operators = await managerUserRepository.getOperatorsByManager(requesterProfile.id);
      const stats = await managerUserRepository.getManagerStats(requesterProfile.id);
      
      // Buscar operadores pendentes (pagamento não confirmado)
      const { prisma } = await import('../../../../infra/data/prisma');
      const pendingOperators = await prisma.pendingOperator.findMany({
        where: { 
          managerId: requesterProfile.id,
          operatorCreated: false,
        },
        orderBy: { createdAt: 'desc' },
      });
      
      // Mapear operadores pendentes para formato de tabela
      const pendingAsUsers = pendingOperators.map(pending => ({
        id: pending.id,
        name: pending.name,
        email: pending.email,
        role: pending.role,
        profileIconUrl: null,
        managerId: requesterProfile.id,
        leadsCount: 0,
        createdAt: pending.createdAt,
        updatedAt: pending.updatedAt,
        isPending: true,
        pendingPayment: {
          id: pending.id,
          paymentId: pending.paymentId,
          paymentStatus: pending.paymentStatus,
          paymentMethod: pending.paymentMethod,
          operatorCreated: pending.operatorCreated,
        },
      }));
      
      // Combinar operadores ativos e pendentes
      const allUsers = [...operators, ...pendingAsUsers];
      
      const output = new Output(true, [], [], allUsers);
      // Add stats to the response
      const responseWithStats = {
        ...output,
        stats
      };
      
      return NextResponse.json(responseWithStats, { status: 200 });
    }

  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * PUT /api/v1/manager/[supabaseId]/users
 * Atualiza usuário ou Associa/desassocia operator de manager
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

    // Se não tiver action, é uma atualização de usuário
    if (!action) {
      console.info("🔄 [PUT /users] Iniciando atualização de usuário");
      console.info("📦 [PUT /users] Body recebido:", JSON.stringify(body, null, 2));
      
      // Validar dados de atualização
      let validatedData;
      try {
        validatedData = UpdateUserSchema.parse(body);
        console.info("✅ [PUT /users] Dados validados:", JSON.stringify(validatedData, null, 2));
      } catch (validationError: any) {
        console.error("❌ [PUT /users] Erro de validação:", validationError);
        const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
        const output = new Output(false, [], errors, null);
        return NextResponse.json(output, { status: 400 });
      }

      // Verificar se o usuário sendo atualizado pertence ao manager
      const userToUpdate = await profileUseCase.getProfileById(validatedData.id);
      if (!userToUpdate) {
        const output = new Output(false, [], ["Usuário não encontrado"], null);
        return NextResponse.json(output, { status: 404 });
      }

      console.info("👤 [PUT /users] Usuário atual:", {
        id: userToUpdate.id,
        currentRole: userToUpdate.role,
        managerId: userToUpdate.managerId
      });

      // Se for operator, verificar se pertence ao manager
      if (userToUpdate.role === 'operator' && userToUpdate.managerId !== requesterProfile.id) {
        const output = new Output(false, [], ["Você só pode atualizar seus próprios operadores"], null);
        return NextResponse.json(output, { status: 403 });
      }

      // Atualizar usuário
      console.info("🚀 [PUT /users] Chamando updateOperator com:", {
        userId: validatedData.id,
        fullName: validatedData.name,
        email: validatedData.email,
        role: validatedData.role
      });
      
      const output = await managerUserUseCase.updateOperator(validatedData.id, {
        fullName: validatedData.name,
        email: validatedData.email,
        role: validatedData.role
      });

      console.info("📤 [PUT /users] Resultado:", {
        isValid: output.isValid,
        successMessages: output.successMessages,
        errorMessages: output.errorMessages,
        result: output.result ? { id: output.result.id, role: output.result.role } : null
      });

      return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
    }

    // Ações de associação/dissociação
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
    
    // Tentar pegar userId do body ou query param
    let userId: string | null = null;
    try {
      const body = await request.json();
      userId = body.userId;
    } catch {
      // Se não conseguir parsear o body, tentar query param
      const { searchParams } = new URL(request.url);
      userId = searchParams.get('userId');
    }
    
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

    // Verificar se o usuário a ser deletado é um operador do manager
    const userToDelete = await profileUseCase.getProfileById(userId);
    
    if (!userToDelete) {
      const output = new Output(false, [], ["Usuário não encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    // Se for operador, usar o novo método com atualização de assinatura
    if (userToDelete.role === 'operator' && userToDelete.managerId === requesterProfile.id) {
      const output = await managerUserUseCase.deleteOperatorWithSubscriptionUpdate(userId);
      return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
    }

    // Para outros casos (manager), usar métodos antigos
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