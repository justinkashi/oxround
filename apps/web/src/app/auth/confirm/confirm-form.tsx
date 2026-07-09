"use client";
// The interstitial UI: a single "Confirm & sign in" button. Lives client-side so it can
// localize (useT) and show a pending state. The actual verification is the server action
// passed in as `action` — submitting this form is the POST that spends the token.

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/lib/i18n";

export default function ConfirmForm({
  action,
  code,
  tokenHash,
  type,
}: {
  action: (prev: unknown, formData: FormData) => Promise<{ dest: string }>;
  code?: string;
  tokenHash?: string;
  type?: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState(action, null);

  // Hard navigation (not router.push) so the browser reloads: the fresh page
  // context re-reads the session cookie set by the action, so the landing page
  // renders with the correct role instead of the stale logged-out state.
  useEffect(() => {
    if (state?.dest) window.location.assign(state.dest);
  }, [state]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-2xl">
        <div className="text-3xl">🥊</div>
        <h1 className="mt-2 text-xl font-bold tracking-tight">{t.auth.confirmTitle}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t.auth.confirmBody}</p>
        <form action={formAction} className="mt-5">
          {code && <input type="hidden" name="code" value={code} />}
          {tokenHash && <input type="hidden" name="token_hash" value={tokenHash} />}
          {type && <input type="hidden" name="type" value={type} />}
          <SubmitButton label={t.auth.confirmButton} pendingLabel={t.auth.confirming} />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
