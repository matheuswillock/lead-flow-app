// Destinos permitidos após o login. Lista fechada: nada de URL absoluta,
// protocol-relative, query ou travessia — evita open redirect.
const ALLOWED_RETURN_PATHS: readonly RegExp[] = [
  /^\/adquirir\/creditos$/,
  /^\/addon-checkout\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
]

export function resolveSafeReturnPath(candidate: string | null | undefined): string | null {
  if (!candidate) return null
  return ALLOWED_RETURN_PATHS.some((pattern) => pattern.test(candidate)) ? candidate : null
}
