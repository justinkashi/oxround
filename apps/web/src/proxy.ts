// Route guard (DEPLOY.md 5.1). Real mode: every page requires a session except
// /login and /auth/callback; also refreshes the session cookie on each request.
// Demo mode (no Supabase env vars): no-op, everything stays open.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/confirm", "/auth/callback"];

export default async function proxy(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next(); // demo mode

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  // IMPORTANT: getUser() (not getSession()) — validates the token server-side.
  const { data: { user } } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  // Auth links (magic link, invite, recovery) can land anywhere with ?code= —
  // forward them to the callback so the code isn't lost.
  if (!user && req.nextUrl.searchParams.has("code") && !isPublic) {
    const cbUrl = req.nextUrl.clone();
    cbUrl.pathname = "/auth/confirm";
    return NextResponse.redirect(cbUrl);
  }

  if (!user && !isPublic) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }
  if (user && path === "/login") {
    const homeUrl = req.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }
  return res;
}

export const config = {
  // Everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
