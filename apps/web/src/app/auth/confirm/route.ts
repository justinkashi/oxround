// Auth email landing (server-side, canonical @supabase/ssr pattern). Two link formats:
//   1. ?token_hash=&type=  — invite emails (template: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite).
//      verifyOtp needs no PKCE verifier, so these work in ANY browser (2026-07-07 fix:
//      GoTrue's default invite link returned tokens in the URL #fragment, which never
//      reaches this server route → every invite bounced to /login?error=no_code).
//   2. ?code=              — login magic links (PKCE): verifier read from cookies, exchanged for a session.
// Route handler (not a page) so it can set session cookies. After either path, the
// middleware (proxy.ts) routes by role: staff → /, member → /app.

import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (!code && !tokenHash) return NextResponse.redirect(`${origin}/login?error=no_code`);

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  );

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    return NextResponse.redirect(`${origin}/`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code!);
  if (error) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  return NextResponse.redirect(`${origin}/`);
}
