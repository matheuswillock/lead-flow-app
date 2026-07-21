import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeAllUsersUseCase } from "@/app/api/useCases/backoffice/BackofficeAllUsersUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

function parseListParam(searchParams: URLSearchParams, key: string): string[] {
  const values = [
    ...searchParams.getAll(key),
    ...(searchParams.get(key)?.split(",") ?? []),
  ]
    .map((value) => value.trim())
    .filter(Boolean)

  return [...new Set(values)]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    console.info("[BackofficeAllUsersEmailDispatchesRoute][GET] iniciado")

    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const { profileId } = await params
    const searchParams = request.nextUrl.searchParams

    const page = Number.parseInt(searchParams.get("page") ?? "1", 10)
    const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "10", 10)
    const query = searchParams.get("q")?.trim() || undefined
    const statuses = parseListParam(searchParams, "status")
    const providers = parseListParam(searchParams, "provider")
    const categories = parseListParam(searchParams, "category")
    const dateFromRaw = searchParams.get("dateFrom")
    const dateToRaw = searchParams.get("dateTo")
    const dateFrom = dateFromRaw ? new Date(dateFromRaw) : undefined
    const dateTo = dateToRaw ? new Date(dateToRaw) : undefined

    const output = await backofficeAllUsersUseCase.getEmailDispatches(profileId, {
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 10,
      filters: {
        query,
        statuses: statuses.length > 0 ? statuses : undefined,
        providers: providers.length > 0 ? providers : undefined,
        categories: categories.length > 0 ? categories : undefined,
        dateFrom,
        dateTo,
      },
    })

    const status = output.isValid
      ? 200
      : output.errorMessages.includes("Usuário não encontrado")
        ? 404
        : 400

    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeAllUsersEmailDispatchesRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
