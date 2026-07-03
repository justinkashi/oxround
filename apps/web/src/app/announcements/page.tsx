"use client";
// A4 Community: owner posts (closures, fights, events), pinned, read counts + reactions
// (critique: read receipts + reactions keep members off WhatsApp).

import { useEffect, useState } from "react";
import { createAnnouncement, listAnnouncements } from "@/lib/data";
import type { Announcement, AnnouncementType } from "@/lib/types";

const TYPES: { value: AnnouncementType; label: string }[] = [
  { value: "general", label: "General" },
  { value: "closure", label: "Gym closure" },
  { value: "fight", label: "Fight announcement" },
  { value: "event", label: "Event / run" },
  { value: "schedule_change", label: "Schedule change" },
];

const TYPE_BADGE: Record<AnnouncementType, string> = {
  general: "bg-neutral-100 text-neutral-600",
  closure: "bg-red-100 text-red-700",
  fight: "bg-purple-100 text-purple-700",
  event: "bg-blue-100 text-blue-700",
  schedule_change: "bg-yellow-100 text-yellow-700",
};

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [form, setForm] = useState({ title: "", body: "", type: "general" as AnnouncementType, pinned: false });

  const load = () => listAnnouncements().then(setItems);
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAnnouncement(form);
    setForm({ title: "", body: "", type: "general", pinned: false });
    load();
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Announcements</h1>

      <form onSubmit={submit} className="mb-8 space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <input
          required
          placeholder="Title — e.g. Gym closed Friday"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <textarea
          placeholder="Details for your members…"
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          rows={3}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-4">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as AnnouncementType })}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
            Pin to top
          </label>
          <button type="submit" className="ml-auto rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            Post + notify members
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Posting sends a push notification to every member with the app and appears in their feed.
        </p>
      </form>

      <div className="space-y-3">
        {items.map((a) => (
          <div key={a.id} className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-1 flex items-center gap-2">
              {a.pinned && <span title="Pinned">📌</span>}
              <h2 className="font-semibold">{a.title}</h2>
              <span className={`ml-auto rounded px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[a.type]}`}>
                {a.type.replace("_", " ")}
              </span>
            </div>
            {a.body && <p className="mb-2 text-sm text-neutral-700">{a.body}</p>}
            <div className="flex gap-4 text-xs text-neutral-500">
              <span>{new Date(a.published_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>
              <span>👁 seen by {a.read_count}</span>
              <span>👊 {a.reaction_count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
