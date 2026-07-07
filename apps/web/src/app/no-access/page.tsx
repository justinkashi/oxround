"use client";
// Shown when a logged-in account has no gym role yet (invited but not linked, or misconfigured).

import { supabase, isDemoMode } from "@/lib/data";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

export default function NoAccessPage() {
  const t = useT();
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-2xl">
        <div className="text-3xl">🥊</div>
        <h1 className="mt-2 text-lg font-bold">{t.noAccess.title}</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {t.noAccess.body}
        </p>
        <button
          onClick={async () => { if (!isDemoMode) await supabase().auth.signOut(); router.push("/login"); }}
          className="mt-5 w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white"
        >
          {t.noAccess.backToSignIn}
        </button>
      </div>
    </div>
  );
}
