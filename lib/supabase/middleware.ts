import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const protectedRoute = [
    "/dashboard",
    "/pedidos",
    "/cozinha",
    "/produtos",
    "/combos",
    "/promocoes",
    "/clientes",
    "/estoque",
    "/financeiro",
    "/pagamentos",
    "/relatorios",
    "/mesas",
    "/usuarios",
    "/entregadores",
    "/configuracoes",
    "/midias"
    ,"/master"
  ].some((path) => request.nextUrl.pathname.startsWith(path));

  // Rotas públicas não precisam consultar a sessão. Além de reduzir latência,
  // isso mantém login, cadastro e cardápio disponíveis caso o Auth esteja
  // temporariamente indisponível.
  if (!protectedRoute) return response;

  const redirectToLogin = () => {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  };

  if (!url || !anonKey) return redirectToLogin();

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    });

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return redirectToLogin();
    return response;
  } catch {
    return redirectToLogin();
  }
}
