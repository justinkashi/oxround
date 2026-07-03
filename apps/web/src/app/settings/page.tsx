"use client";
// Gym settings: business info, hours, cancellation policy. (FEATURES: Settings & Customization)

import { useEffect, useState } from "react";
import { getSettings, saveSettings, isDemoMode } from "@/lib/data";
import type { GymSettings } from "@/lib/types";

export default function SettingsPage() {
  const [s, setS] = useState<GymSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getSettings().then(setS); }, []);
  if (!s) return <div className="text-neutral-500">Loading…</div>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const field = (label: string, key: keyof GymSettings, type: "text" | "number" = "text") => (
    <label className="block text-sm font-medium">
      {label}
      <input
        type={type}
        value={String(s[key])}
        onChange={(e) => setS({ ...s, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-normal"
      />
    </label>
  );

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
        {field("Gym name", "name")}
        {field("Address", "address")}
        <div className="grid grid-cols-2 gap-4">
          {field("Phone", "phone")}
          {field("Email", "email")}
        </div>
        {field("Operating hours", "hours")}
        {field("Cancellation policy (hours before class)", "cancellation_policy_hours", "number")}
        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">Save settings</button>
          {saved && <span className="text-sm text-green-700">Saved ✓</span>}
        </div>
      </form>

      <div className="mt-6 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
        <div className="font-semibold text-neutral-600">Coming with deployment</div>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Logo upload (Storage bucket)</li>
          <li>Kiosk management — QR rotation + kiosk device setup (pending decision D-01)</li>
          <li>Per-gym feature flags</li>
        </ul>
        {isDemoMode && <p className="mt-2 text-xs">Demo mode: changes persist for this browser session only.</p>}
      </div>
    </div>
  );
}
