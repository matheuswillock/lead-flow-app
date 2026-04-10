import { NextRequest, NextResponse } from 'next/server';
import { Output } from '@/lib/output';
import { ForgotPasswordUseCase } from '@/app/api/useCases/auth/ForgotPasswordUseCase';

const forgotPasswordUseCase = new ForgotPasswordUseCase();

/**
 * POST /api/v1/auth/forgot-password
 * Envia e-mail de recuperação de senha para usuário
 */
export async function POST(request: NextRequest) {
  const routeName = '[ForgotPasswordRoute][POST]';

  try {
    const body = await request.json();

    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const originScreen = request.headers.get('x-origin-screen') || 'unknown';
    const output = await forgotPasswordUseCase.execute({
      email: body?.email,
      ip,
      userAgent,
      originScreen,
    });

    console.info(`${routeName} Completed`, {
      isValid: output.isValid,
      ip,
      originScreen,
    });

    return NextResponse.json(output, { status: 200 });
  } catch (error: unknown) {
    console.error(`${routeName} Unexpected error`, error);
    
    return NextResponse.json(
      new Output(
        true,
        ['Link enviado com sucesso para seu e-mail.'],
        [],
        null,
      ),
      { status: 200 }
    );
  }
}
