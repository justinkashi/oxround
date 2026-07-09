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
import { resolveHome, rolesFromToken } from "@/lib/auth";

// Returns the destination for the CLIENT to navigate to with a full page load
// (window.location), NOT a server redirect(). The session cookie is set here
// server-side; a hard navigation forces the browser's Supabase client and the
// root layout to re-read it, so the landing page renders with the right role
// instead of the logged-out state left over from /login (which a soft redirect
// would preserve — that was the "owner sees coach menu until refresh" bug).
export async function confirmAuth(_prev: unknown, formData: FormData): Promise<{ dest: string }> {
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
  let passwordSet = false; // has this user already chosen a password? (user_metadata flag)
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) dest = `/login?error=${encodeURIComponent(error.message)}`;
    else {
      token = data.session?.access_token;
      passwordSet = data.user?.user_metadata?.password_set === true;
      await supabase.rpc("mark_member_activated"); // idempotent; no-op if not a member
    }
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) dest = `/login?error=${encodeURIComponent(error.message)}`;
    else {
      token = data.session?.access_token;
      passwordSet = data.user?.user_metadata?.password_set === true;
      await supabase.rpc("mark_member_activated");
    }
  } else {
    dest = "/login?error=no_code";
  }

  // First time in (any role) and no password chosen yet → nudge them to set one so
  // next time they can sign in without an email link. The screen is skippable, so
  // nobody is locked out. Once a password exists they sign in directly and never
  // hit this action again. Otherwise route by role at the moment the session is
  // created, so members land straight in /app instead of flashing the CRM.
  if (!dest) dest = passwordSet ? resolveHome(rolesFromToken(token)) : "/auth/set-password";

  return { dest };
}
