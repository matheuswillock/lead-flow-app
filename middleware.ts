import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { API_CLIENT_SLUG } from '@/lib/route-map';

/**
 * Rate limiting simples por IP usando contadores em memória.
 * Para ambientes multi-instância, substituir por Vercel KV.
 * Janela de 60 segundos, máximo de 120 requisições por IP.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

/** Prefixo público para chamadas client-side: /api/q/... */
const SLUG_PREFIX = `/api/${API_CLIENT_SLUG}/`;

/** Prefixo real da API: reescrito internamente, nunca exposto ao browser. */
const REAL_API_PREFIX = '/api/v1/';

/**
 * Middleware principal do Next.js 15.
 *
 * Responsabilidades (em ordem de execução):
 * 1. Rate limiting por IP
 * 2. URL rewriting: /api/q/[slug]/** → /api/v1/**
 *    O browser vê /api/q/... ; o Route Handler recebe /api/v1/...
 * 3. Refresh de sessão Supabase (obrigatório para SSR com @supabase/ssr)
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  // 1. Rate limiting
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  if (!checkRateLimit(ip)) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }

  // 2. URL rewriting: /api/q/** → /api/v1/**
  if (pathname.startsWith(SLUG_PREFIX)) {
    const rest = pathname.slice(SLUG_PREFIX.length);
    const rewrittenUrl = request.nextUrl.clone();
    rewrittenUrl.pathname = REAL_API_PREFIX + rest;

    const rewriteResponse = NextResponse.rewrite(rewrittenUrl);
    // Propaga headers de segurança para a resposta reescrita
    rewriteResponse.headers.set('X-Content-Type-Options', 'nosniff');
    rewriteResponse.headers.set('X-Frame-Options', 'DENY');
    return rewriteResponse;
  }

  // 3. Refresh de sessão Supabase (mantém cookies válidos em SSR)
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    // Necessário para manter a sessão atualizada — não remover.
    await supabase.auth.getUser();
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Executa em todas as rotas exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Arquivos com extensão (imagens, fontes, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|ico)).*)',
  ],
};
