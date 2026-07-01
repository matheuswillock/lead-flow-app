/** Erro esperado de API (validação, permissão, etc.) — não deve ir para console.error. */
export class ApiRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ApiRequestError"
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError
}
