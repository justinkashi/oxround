// Double-submit guard (VERSION 2): one hook for every form/button that mutates.
// The wrapped action cannot run twice concurrently; `submitting` drives the
// button's disabled state. Errors surface as a toast (and are re-thrown so the
// caller can also render inline feedback if it wants).
"use client";

import { useCallback, useRef, useState } from "react";
import { notify } from "@/components/toast";

export function useSubmit<A extends unknown[]>(
  action: (...args: A) => Promise<void>,
  opts?: { successMessage?: string; rethrow?: boolean },
) {
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false); // ref: instant guard even before React re-renders

  const run = useCallback(
    async (...args: A) => {
      if (inFlight.current) return; // hard double-click guard
      inFlight.current = true;
      setSubmitting(true);
      try {
        await action(...args);
        if (opts?.successMessage) notify("success", opts.successMessage);
      } catch (e) {
        notify("error", e instanceof Error ? e.message : "Something went wrong.");
        if (opts?.rethrow) throw e;
      } finally {
        inFlight.current = false;
        setSubmitting(false);
      }
    },
    [action, opts?.successMessage, opts?.rethrow],
  );

  return { submitting, run };
}
