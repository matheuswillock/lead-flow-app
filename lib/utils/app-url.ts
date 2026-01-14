/**
 * Retorna a URL base da aplicação a partir das variáveis de ambiente
 * @throws Error se NEXT_PUBLIC_APP_URL não estiver configurada
 * @param options - Opções para customizar o comportamento
 * @param options.removeTrailingSlash - Remove barra final da URL (padrão: false)
 * @returns URL base da aplicação
 */
export function getAppUrl(options: { removeTrailingSlash?: boolean } = {}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL não está configurada nas variáveis de ambiente');
  }

  if (options.removeTrailingSlash) {
    return appUrl.replace(/\/$/, '');
  }

  return appUrl;
}

/**
 * Retorna a URL completa para um caminho específico
 * @param path - Caminho relativo (ex: '/dashboard', '/set-password')
 * @returns URL completa
 */
export function getFullUrl(path: string): string {
  const appUrl = getAppUrl({ removeTrailingSlash: true });
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${appUrl}${cleanPath}`;
}
