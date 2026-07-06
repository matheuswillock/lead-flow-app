import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { BackofficePlatformUsersUseCase } from "@/app/api/useCases/backoffice/BackofficePlatformUsersUseCase"
import { BackofficePlatformUsersRepository } from "@/app/api/infra/data/repositories/backoffice/PlatformUsersRepository/BackofficePlatformUsersRepository"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { id } = await params
    const useCase = new BackofficePlatformUsersUseCase(new BackofficePlatformUsersRepository())
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") ?? undefined
    const page = parsePositiveInt(searchParams.get("page"), 1)
    const pageSize = Math.max(parsePositiveInt(searchParams.get("pageSize"), 10), 5)

    const output = await useCase.getMasterUserDetails(id, {
      query,
      page,
      pageSize,
    })
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficePlatformUserByIdRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireMasterAccess(result.access)
    if (denied) return denied

    const { id } = await params
    const body = await request.json()

    const nullableString = (v: unknown) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : undefined)
    const optionalString = (v: unknown) => (typeof v === "string" ? v : undefined)
    const optionalStringArray = (v: unknown): string[] | undefined =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined

    const data = {
      fullName: optionalString(body.fullName),
      phone: nullableString(body.phone),
      cpfCnpj: nullableString(body.cpfCnpj),
      postalCode: nullableString(body.postalCode),
      address: nullableString(body.address),
      addressNumber: nullableString(body.addressNumber),
      neighborhood: nullableString(body.neighborhood),
      complement: nullableString(body.complement),
      city: nullableString(body.city),
      state: nullableString(body.state),
      functions: optionalStringArray(body.functions),
      hasPermanentSubscription: typeof body.hasPermanentSubscription === "boolean"
        ? body.hasPermanentSubscription
        : undefined,
      multiskillEnabled: typeof body.multiskillEnabled === "boolean"
        ? body.multiskillEnabled
        : undefined,
    }

    const useCase = new BackofficePlatformUsersUseCase(new BackofficePlatformUsersRepository())
    const output = await useCase.updateMasterUser(id, data)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficePlatformUserByIdRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireMasterAccess(result.access)
    if (denied) return denied

    const { id } = await params
    const useCase = new BackofficePlatformUsersUseCase(new BackofficePlatformUsersRepository())
    const output = await useCase.deleteMasterUser(id)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficePlatformUserByIdRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
