/** Erro esperado de API (validação, permissão, etc.) — não deve ir para console.error. */
export class ApiRequestError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError
}

export function isUnauthorizedApiError(error: unknown): boolean {
  return isApiRequestError(error) && error.status === 401
}
