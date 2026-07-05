"use client";
// Login. Real mode: Supabase magic link → /auth/confirm (server-side code exchange).
// Signups disabled project-wide (invite-only), so shouldCreateUser: false.
// Demo mode: mock continue button.

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isDemoMode, supabase } from "@/lib/data";

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}

function LoginInner() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(useSearchParamsError());
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isDemoMode) {
      setSent(true);
      return;
    }
    setBusy(true);
    const { error } = await supabase().auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    setBusy(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes("signup")
          ? "This email doesn't have an account. Accounts are invite-only — contact your gym."
          : error.message,
      );
      return;
    }
    setSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="text-3xl">🥊</div>
          <h1 className="mt-2 text-xl font-bold tracking-tight">OxRound</h1>
          <p className="text-sm text-neutral-500">Sign in</p>
        </div>

        {!sent ? (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              required
              placeholder="you@yourgym.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
            {error && <p className="rounded-md bg-red-50 p-3 text-center text-xs text-red-700">{error}</p>}
            <p className="text-center text-xs text-neutral-400">No password — we email you a sign-in link.</p>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <div className="rounded-md bg-green-50 p-4 text-sm text-green-800">
              Sign-in link sent to <span className="font-semibold">{email}</span>. Open it in this browser.
            </div>
            {isDemoMode && (
              <button onClick={() => router.push("/")} className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white">
                Continue (demo — simulates clicking the link)
              </button>
            )}
            {!isDemoMode && (
              <button onClick={() => setSent(false)} className="text-xs text-neutral-500 hover:underline">
                Use a different email
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Surface an error passed back from /auth/confirm (e.g. expired link).
function useSearchParamsError(): string | null {
  const params = useSearchParams();
  const err = params.get("error");
  if (!err) return null;
  if (err === "no_code") return "That sign-in link was incomplete. Request a new one.";
  return "That link didn't work — it may have expired. Request a new one.";
}
