import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { DEFAULT_MASTER_DOMAIN, isMasterHostname } from "@/lib/master/domain";

export async function middleware(request: NextRequest) {
  if (isMasterHostname(request.headers.get("host"), process.env.MASTER_DOMAIN || DEFAULT_MASTER_DOMAIN)) {
    const path = request.nextUrl.pathname;
    const allowed = path.startsWith("/master") || path.startsWith("/login") || path.startsWith("/auth/") || path === "/sem-permissao";
    if (!allowed) {
      const masterUrl = request.nextUrl.clone();
      masterUrl.pathname = "/master";
      masterUrl.search = "";
      return NextResponse.redirect(masterUrl);
    }
    if (path === "/") {
      const masterUrl = request.nextUrl.clone();
      masterUrl.pathname = "/master";
      return NextResponse.redirect(masterUrl);
    }
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
