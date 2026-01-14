import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

/**
 * POST /api/auth/login
 * Endpoint para autenticação via Insomnia/Postman
 * Retorna cookies de sessão do Supabase
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { 
          error: 'Email e senha são obrigatórios',
          isValid: false,
          errorMessages: ['Email e senha são obrigatórios'],
          successMessages: [],
          result: null
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServer();

    if (!supabase) {
      return NextResponse.json(
        {
          error: 'Erro ao criar cliente Supabase',
          isValid: false,
          errorMessages: ['Erro ao criar cliente Supabase'],
          successMessages: [],
          result: null
        },
        { status: 500 }
      );
    }

    // Fazer login via Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          isValid: false,
          errorMessages: [error.message],
          successMessages: [],
          result: null
        },
        { status: 401 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        {
          error: 'Usuário não encontrado',
          isValid: false,
          errorMessages: ['Usuário não encontrado'],
          successMessages: [],
          result: null
        },
        { status: 401 }
      );
    }

    // Os cookies já foram configurados pelo createSupabaseServer
    // Retornar sucesso com informações do usuário
    return NextResponse.json(
      {
        isValid: true,
        successMessages: ['Login realizado com sucesso'],
        errorMessages: [],
        result: {
          user: {
            id: data.user.id,
            email: data.user.email,
            role: data.user.role,
          },
          session: {
            access_token: data.session?.access_token,
            refresh_token: data.session?.refresh_token,
          }
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Erro no login:', error);
    
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        isValid: false,
        errorMessages: ['Erro interno do servidor'],
        successMessages: [],
        result: null
      },
      { status: 500 }
    );
  }
}
