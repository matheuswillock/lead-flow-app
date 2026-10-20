import { NextResponse } from 'next/server'

// CRON_SECRET must be set in environment variables
const CRON_SECRET = process.env.CRON_SECRET

if (!CRON_SECRET) {
  throw new Error('CRON_SECRET environment variable is not set')
}

// UseCase for cron execution - no direct service import
import { StudioDomainDnsCronUseCase } from '@/app/api/useCases/studioDomainDnsAudit/StudioDomainDnsCronUseCase'

// Route protected by CRON_SECRET header
export const POST = async (request: Request) => {
  const authHeader = request.headers.get('x-cron-secret')

  if (!authHeader || authHeader !== CRON_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid CRON_SECRET' },
      { status: 401 }
    )
  }

  try {
    const useCase = new StudioDomainDnsCronUseCase(
      {} as any,
      {} as any
    )

    const result = await useCase.execute()

    return NextResponse.json({
      success: true,
      message: 'DNS audit completed',
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron reconcile-dns error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}