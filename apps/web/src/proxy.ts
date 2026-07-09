// Route guard + role router (DEPLOY.md Step 6A).
// Real mode: requires a session; routes by role — staff → CRM, member → /app.
// Roles come from the JWT (custom_access_token_hook).

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveHome, rolesFromToken, STAFF_ROLES } from "@/lib/auth";

const DEMO_PROJECT_REF = "qgyfbebqlggcxsjmnmhh";
const PUBLIC_PATHS = ["/login", "/auth/confirm", "/auth/callback", "/auth/demo", "/no-access"];
const DEMO_AUTO_LOGIN_SKIP_PATHS = ["/auth/confirm", "/auth/callback", "/auth/demo", "/no-access"];

function isDemoAutoLoginEnabled(supabaseUrl: string): boolean {
  return process.env.DEMO_AUTO_LOGIN === "true" && supabaseUrl.includes(DEMO_PROJECT_REF);
}

export default async function proxy(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. OxRound requires Supabase for all app runs.");
  }

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

  // getUser() validates the token server-side.
  const { data: { user } } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  const skipDemoAutoLogin = DEMO_AUTO_LOGIN_SKIP_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && isDemoAutoLoginEnabled(url) && !skipDemoAutoLogin) {
    const demoUrl = req.nextUrl.clone();
    demoUrl.pathname = "/auth/demo";
    demoUrl.searchParams.set("next", `${path}${req.nextUrl.search}`);
    return NextResponse.redirect(demoUrl);
  }

  // Auth links land anywhere with ?code= — forward to the callback.
  if (!user && req.nextUrl.searchParams.has("code") && !isPublic) {
    const cbUrl = req.nextUrl.clone();
    cbUrl.pathname = "/auth/confirm";
    return NextResponse.redirect(cbUrl);
  }

  // Not logged in → login (except public pages).
  if (!user && !isPublic) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (user) {
    const { data: { session } } = await supabase.auth.getSession();
    const roles = rolesFromToken(session?.access_token);
    const isStaff = roles.some((r) => STAFF_ROLES.includes(r));
    const isMember = roles.includes("member");
    const inMemberApp = path === "/app" || path.startsWith("/app/");
    const redirectTo = (p: string) => {
      const u = req.nextUrl.clone();
      u.pathname = p;
      u.search = "";
      return NextResponse.redirect(u);
    };

    // Landed on /login while authed → send to the right home.
    if (path === "/login") return redirectTo(resolveHome(roles));

    // No usable role at all → explain, don't loop.
    if (!isStaff && !isMember && !isPublic) return redirectTo("/no-access");

    // Member (not staff) trying to reach a CRM page → bounce to their app.
    if (isMember && !isStaff && !inMemberApp && !isPublic) return redirectTo("/app");

    // Staff on member app = allowed (preview). Staff on CRM = allowed.
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
