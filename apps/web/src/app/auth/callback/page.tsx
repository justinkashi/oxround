"use client";
// Magic-link landing: exchanges the ?code= from the email link for a session cookie,
// then enters the app. Must run in the same browser that requested the link (PKCE).

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/data";
import { resolveHome, rolesFromToken } from "@/lib/auth";
import { getMessages, useT } from "@/lib/i18n";

function CallbackInner() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const errDesc = params.get("error_description");
    if (errDesc) {
      setError(errDesc);
      return;
    }
    if (!code) {
      setError(getMessages().auth.noCode);
      return;
    }
    supabase()
      .auth.exchangeCodeForSession(code)
      .then(({ data, error }) => {
        if (error) setError(`${error.message}. ${getMessages().auth.expiredOrBrowser}`);
        else router.replace(resolveHome(rolesFromToken(data.session?.access_token)));
      });
  }, [params, router]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-2xl">
        {!error ? (
          <>
            <div className="text-3xl">🥊</div>
            <p className="mt-3 text-sm text-neutral-600">{t.auth.signingIn}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-red-700">{t.auth.failed}</p>
            <p className="mt-2 text-xs text-neutral-600">{error}</p>
            <Link href="/login" className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
              {t.auth.backToLogin}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return <Suspense fallback={<AuthLoading />}><CallbackInner /></Suspense>;
}

function AuthLoading() {
  const t = useT();
  return <div className="p-8 text-neutral-500">{t.auth.signingIn}</div>;
}
