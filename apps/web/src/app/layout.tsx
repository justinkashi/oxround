import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import "./globals.css";
import Shell from "./shell";
import { Toasts } from "@/components/toast";
import { LocaleProvider } from "@/lib/i18n";
import { rolesFromToken } from "@/lib/auth";

export const metadata: Metadata = {
  title: "OxRound — G1 Boxing",
  description: "Combat-sports-first gym operating system",
};

// Read the signed-in user's roles server-side so the CRM nav renders the correct
// menu on first paint. Reading them client-side raced the token hydration right
// after login and briefly showed the trimmed (non-owner) menu until a refresh.
async function rolesFromCookies(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return [];
  const store = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: { getAll: () => store.getAll(), setAll: () => {} },
  });
  const { data: { session } } = await supabase.auth.getSession();
  return rolesFromToken(session?.access_token);
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const roles = await rolesFromCookies();
  return (
    <html lang="en">
      <body>
        <LocaleProvider>
          <Shell roles={roles}>{children}</Shell>
          <Toasts />
        </LocaleProvider>
      </body>
    </html>
  );
}
