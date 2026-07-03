"use client";
// Login (mock): magic-link flow UI. In demo mode the "link" is a button that continues straight in.
// Real Supabase magic-link auth replaces the mock branch at deployment (DEPLOY.md B1).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isDemoMode } from "@/lib/data";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="text-3xl">🥊</div>
          <h1 className="mt-2 text-xl font-bold tracking-tight">OxRound</h1>
          <p className="text-sm text-neutral-500">Gym owner sign-in</p>
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
            <button type="submit" className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
              Send magic link
            </button>
            <p className="text-center text-xs text-neutral-400">No password — we email you a sign-in link.</p>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <div className="rounded-md bg-green-50 p-4 text-sm text-green-800">
              Magic link sent to <span className="font-semibold">{email}</span>. Check your inbox.
            </div>
            {isDemoMode && (
              <button onClick={() => router.push("/")} className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white">
                Continue (demo — simulates clicking the link)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
