// Global toast notifications (VERSION 2). No library — a tiny event bus + one
// fixed-position stack rendered by <Toasts/> in the root layout.
"use client";

import { useEffect, useState } from "react";

export type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; text: string };

// Fire a toast from anywhere (components, data layer, event handlers).
export function notify(kind: ToastKind, text: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ox-toast", { detail: { kind, text } }));
}

const KIND_STYLES: Record<ToastKind, string> = {
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
  error: "border-red-300 bg-red-50 text-red-800",
  info: "border-neutral-300 bg-white text-neutral-700",
};

export function Toasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const { kind, text } = (e as CustomEvent).detail as { kind: ToastKind; text: string };
      const id = ++n + Date.now();
      setToasts((t) => [...t, { id, kind, text }]);
      // Errors stay longer so they can be read; successes clear fast.
      const ttl = kind === "error" ? 8000 : 3500;
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
    };
    window.addEventListener("ox-toast", onToast);
    return () => window.removeEventListener("ox-toast", onToast);
  }, []);

  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${KIND_STYLES[t.kind]}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
