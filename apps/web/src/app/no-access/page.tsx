"use client";
// Shown when a logged-in account has no gym role yet (invited but not linked, or misconfigured).

import { supabase, isDemoMode } from "@/lib/data";
import { useRouter } from "next/navigation";

export default function NoAccessPage() {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-2xl">
        <div className="text-3xl">🥊</div>
        <h1 className="mt-2 text-lg font-bold">No access yet</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Your account isn&apos;t linked to a gym yet. Contact your gym owner to be added.
        </p>
        <button
          onClick={async () => { if (!isDemoMode) await supabase().auth.signOut(); router.push("/login"); }}
          className="mt-5 w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
}
