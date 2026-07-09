"use client";
// Set / change password. Reached two ways, both landing here with a live session:
//   • First login after an invite → /auth/confirm established the session (cookies),
//     then routed here because the user has no password yet. Skippable.
//   • "Forgot password?" → recovery email lands here with a ?code the browser Supabase
//     client auto-exchanges (detectSessionInUrl) into a session.
// Either way, updateUser({ password }) sets the password in Supabase's auth.users and
// stamps user_metadata.password_set so we stop nudging them.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/data";
import { resolveHome, rolesFromToken } from "@/lib/auth";
import { LanguageToggle, useT } from "@/lib/i18n";

export default function SetPasswordPage() {
  return <Suspense><SetPasswordInner /></Suspense>;
}

function SetPasswordInner() {
  const t = useT();
  const [ready, setReady] = useState(false); // session confirmed present
  const [invalid, setInvalid] = useState(false); // no session showed up → bad/expired link
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabase();
    let settled = false;
    const mark = () => { settled = true; setReady(true); };

    sb.auth.getSession().then(({ data }) => { if (data.session) mark(); });
    // Recovery links arrive with ?code the client exchanges asynchronously.
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { if (session) mark(); });
    const timer = setTimeout(() => { if (!settled) setInvalid(true); }, 4000);

    return () => { sub.subscription.unsubscribe(); clearTimeout(timer); };
  }, []);

  // Leave for the right home based on the current session's roles, full page load so
  // the middleware and layout re-read cookies.
  const proceed = async () => {
    const { data } = await supabase().auth.getSession();
    window.location.assign(resolveHome(rolesFromToken(data.session?.access_token)));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError(t.auth.setPwTooShort); return; }
    if (password !== confirm) { setError(t.auth.setPwMismatch); return; }
    setBusy(true);
    const { error } = await supabase().auth.updateUser({
      password,
      data: { password_set: true },
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    await proceed();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-5 text-center">
          <div className="text-3xl">🔒</div>
          <h1 className="mt-2 text-xl font-bold tracking-tight">{t.auth.setPwTitle}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t.auth.setPwBody}</p>
        </div>

        {invalid ? (
          <div className="space-y-4 text-center">
            <p className="rounded-md bg-red-50 p-3 text-xs text-red-700">{t.auth.setPwExpired}</p>
            <Link href="/login" className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
              {t.auth.backToLogin}
            </Link>
          </div>
        ) : !ready ? (
          <p className="py-6 text-center text-sm text-neutral-500">{t.common.loading}</p>
        ) : (
          <form onSubmit={save} className="space-y-3">
            <input
              type="password"
              required
              placeholder={t.auth.setPwPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm"
            />
            <input
              type="password"
              required
              placeholder={t.auth.setPwConfirmPlaceholder}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? t.common.saving : t.auth.setPwSave}
            </button>
            {error && <p className="rounded-md bg-red-50 p-3 text-center text-xs text-red-700">{error}</p>}
            <button type="button" onClick={proceed} disabled={busy} className="w-full text-center text-xs text-neutral-500 hover:underline disabled:opacity-50">
              {t.auth.setPwSkip}
            </button>
          </form>
        )}

        <div className="mt-6 flex justify-center"><LanguageToggle /></div>
      </div>
    </div>
  );
}
