import { NextRequest, NextResponse, connection } from 'next/server';
import { getTeamAccess } from '@/app/api/v1/utils/teamAccess';
import { lookupPortfolioCnpjUseCase } from '@/app/api/useCases/portfolio/LookupPortfolioCnpjUseCase';
import { sanitizeDocumentDigits } from '@/lib/masks';

export async function GET(request: NextRequest) {
  await connection();

  const teamAccess = await getTeamAccess(request);
  if (teamAccess.error) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status });
  }

  const cnpj = sanitizeDocumentDigits(new URL(request.url).searchParams.get('cnpj') ?? '');
  if (cnpj.length !== 14) {
    return NextResponse.json(
      { isValid: false, successMessages: [], errorMessages: ['CNPJ inválido'], result: null },
      { status: 400 },
    );
  }

  const output = await lookupPortfolioCnpjUseCase.execute(cnpj);
  return NextResponse.json(output, { status: output.isValid ? 200 : 502 });
}
