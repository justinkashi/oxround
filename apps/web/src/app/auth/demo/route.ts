import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEMO_PROJECT_REF = "qgyfbebqlggcxsjmnmhh";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/auth/demo")) return "/";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.DEMO_LOGIN_EMAIL;
  const password = process.env.DEMO_LOGIN_PASSWORD;

  if (
    process.env.DEMO_AUTO_LOGIN !== "true" ||
    !url ||
    !url.includes(DEMO_PROJECT_REF) ||
    !anon ||
    !email ||
    !password
  ) {
    return NextResponse.redirect(`${origin}/login?error=demo_not_configured`);
  }

  const cookieStore = await cookies();
  const redirectTo = `${origin}${safeNext(searchParams.get("next"))}`;
  const response = NextResponse.redirect(redirectTo);
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);

  return response;
}
