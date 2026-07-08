"use client";
// Login. Real mode: Supabase magic link → /auth/confirm (server-side code exchange).
// Signups disabled project-wide (invite-only), so shouldCreateUser: false.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/data";
import { LanguageToggle, useT, type Messages } from "@/lib/i18n";

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}

type Role = "member" | "coach" | "owner";

const ROLE_TABS: { id: Role; icon: string; label: keyof Messages["login"]; subtitle: keyof Messages["login"]; placeholder: keyof Messages["login"] }[] = [
  { id: "member", icon: "🥊", label: "memberTab", subtitle: "memberSubtitle", placeholder: "memberPlaceholder" },
  { id: "coach", icon: "🧤", label: "coachTab", subtitle: "coachSubtitle", placeholder: "coachPlaceholder" },
  { id: "owner", icon: "🏟️", label: "ownerTab", subtitle: "ownerSubtitle", placeholder: "ownerPlaceholder" },
];

function LoginInner() {
  const t = useT();
  const [role, setRole] = useState<Role>("member");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(useSearchParamsError());
  const [busy, setBusy] = useState(false);
  const tab = ROLE_TABS.find((t) => t.id === role)!;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
        error.message.toLowerCase().includes("signup") ? t.login.inviteOnly : error.message,
      );
      return;
    }
    setSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-5 text-center">
          <div className="text-3xl">{tab.icon}</div>
          <h1 className="mt-2 text-xl font-bold tracking-tight">OxRound</h1>
          <p className="text-sm text-neutral-500">{t.login[tab.subtitle]}</p>
        </div>

        {/* Role tabs */}
        <div className="mb-5 grid grid-cols-3 gap-1 rounded-lg bg-neutral-100 p-1">
          {ROLE_TABS.map((rt) => (
            <button
              key={rt.id}
              type="button"
              onClick={() => { setRole(rt.id); setError(null); }}
              className={`rounded-md px-2 py-1.5 text-sm font-medium transition ${
                role === rt.id
                  ? "bg-white text-neutral-900 shadow"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {t.login[rt.label]}
            </button>
          ))}
        </div>

        {!sent ? (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              required
              placeholder={t.login[tab.placeholder]}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? t.common.sending : t.login.emailMeLink}
            </button>
            {error && <p className="rounded-md bg-red-50 p-3 text-center text-xs text-red-700">{error}</p>}
            <p className="text-center text-xs text-neutral-400">{t.login.noPassword}</p>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <div className="rounded-md bg-green-50 p-4 text-sm text-green-800">
              {t.login.linkSentBefore} <span className="font-semibold">{email}</span>{t.login.linkSentAfter}
            </div>
            <button onClick={() => setSent(false)} className="text-xs text-neutral-500 hover:underline">
              {t.login.useDifferentEmail}
            </button>
          </div>
        )}

        <div className="mt-6 flex justify-center"><LanguageToggle /></div>
      </div>
    </div>
  );
}

// Surface an error passed back from /auth/confirm (e.g. expired link).
function useSearchParamsError(): string | null {
  const t = useT();
  const params = useSearchParams();
  const err = params.get("error");
  if (!err) return null;
  if (err === "no_code") return t.login.linkIncomplete;
  return t.login.linkFailed;
}
