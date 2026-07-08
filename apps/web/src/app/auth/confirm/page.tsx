// Auth email landing — button interstitial (server component).
// GET renders a confirm button instead of verifying immediately, so email scanners that
// prefetch the link with a GET don't burn the single-use token. The button submits a POST
// to the confirmAuth server action (see actions.ts), which does the real verification.

import { redirect } from "next/navigation";
import { confirmAuth } from "./actions";
import ConfirmForm from "./confirm-form";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string }>;
}) {
  const { code, token_hash, type } = await searchParams;
  if (!code && !token_hash) redirect("/login?error=no_code");

  return (
    <ConfirmForm
      action={confirmAuth}
      code={code}
      tokenHash={token_hash}
      type={type}
    />
  );
}
