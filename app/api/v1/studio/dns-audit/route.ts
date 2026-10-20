import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Manual DNS audit route - authenticated by team token
import { StudioDomainDnsAuditUseCase } from '@/app/api/useCases/studioDomainDnsAudit/StudioDomainDnsAuditUseCase'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  // Team authentication - check for valid team token
  const validTeamTokens = process.env.VALID_TEAM_TOKENS?.split(',') || []
  const isAuthenticated = validTeamTokens.includes(authHeader || '')

  if (!isAuthenticated) {
    return NextResponse.json(
      { error: 'Unauthorized: Team authentication required' },
      { status: 401 }
    )
  }

  try {
    const useCase = new StudioDomainDnsAuditUseCase(
      {} as any,
      {} as any
    )

    const result = await useCase.execute()

    return NextResponse.json({
      success: true,
      message: 'Manual DNS audit executed',
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Manual DNS audit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}