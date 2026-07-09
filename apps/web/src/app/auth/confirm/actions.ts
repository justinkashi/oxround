"use server";
// Server action that actually verifies an auth email link and sets the session cookies.
// It runs only on POST (form submit), NOT on GET — this is the whole point of the button
// interstitial: corporate mail scanners / "safe link" checkers prefetch links with a GET,
// which would otherwise consume the single-use token before the member ever clicks. Their
// GET now just renders the page; the token is spent only when a human taps the button.
//
// Cookies are set server-side (via @supabase/ssr) so the middleware (proxy.ts) can read the
// session on the redirect and route by role. Two link formats, same as before:
//   token_hash + type — invite emails (verifyOtp, works in any browser)
//   code             — login magic links (PKCE, exchangeCodeForSession)

import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveHome, rolesFromToken } from "@/lib/auth";

export async function confirmAuth(formData: FormData) {
  const code = (formData.get("code") as string) || null;
  const tokenHash = (formData.get("token_hash") as string) || null;
  const type = (formData.get("type") as EmailOtpType | null) || null;

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

  // "" = session established, route by role below. Anything else = an error page.
  let dest = "";
  let token: string | undefined; // access token from the verify — carries roles[] claims
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) dest = `/login?error=${encodeURIComponent(error.message)}`;
    else {
      token = data.session?.access_token;
      await supabase.rpc("mark_member_activated"); // idempotent; no-op if not a member
    }
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) dest = `/login?error=${encodeURIComponent(error.message)}`;
    else {
      token = data.session?.access_token;
      await supabase.rpc("mark_member_activated");
    }
  } else {
    dest = "/login?error=no_code";
  }

  // Route by role at the moment the session is created, so members land straight in
  // /app instead of flashing the CRM and getting corrected by the proxy a click later.
  // Use the token returned by the verify itself (not a second getSession round-trip).
  if (!dest) dest = resolveHome(rolesFromToken(token));

  redirect(dest); // throws NEXT_REDIRECT — must stay outside any try/catch
}
