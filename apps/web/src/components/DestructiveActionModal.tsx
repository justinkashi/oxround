// Standardized confirmation for destructive actions (VERSION 2).
// Replaces browser confirm(). For high-impact actions pass confirmText —
// the user must type it exactly to unlock the red button.
"use client";

import { useEffect, useState } from "react";
import { useSubmit } from "@/lib/useSubmit";
import { useT } from "@/lib/i18n";

type Props = {
  open: boolean;
  title: string;
  description: string;
  actionLabel: string;         // e.g. "Archive member"
  confirmText?: string;        // e.g. the member's name — required typing for high-impact actions
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

export default function DestructiveActionModal({
  open, title, description, actionLabel, confirmText, onConfirm, onClose,
}: Props) {
  const t = useT();
  const [typed, setTyped] = useState("");
  const { submitting, run } = useSubmit(async () => {
    await onConfirm();
    onClose();
  });

  // Reset the typed text each time the modal opens for a new target.
  useEffect(() => { if (open) setTyped(""); }, [open]);

  if (!open) return null;
  const locked = !!confirmText && typed.trim() !== confirmText.trim();

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="mt-2 text-sm text-neutral-600">{description}</p>

        {confirmText && (
          <div className="mt-4">
            <label className="text-xs text-neutral-500">
              {t.modal.typeToConfirmBefore} <span className="font-mono font-semibold text-neutral-800">{confirmText}</span> {t.modal.typeToConfirmAfter}
            </label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-red-500"
              placeholder={confirmText}
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={() => run()}
            disabled={locked || submitting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? t.common.working : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
