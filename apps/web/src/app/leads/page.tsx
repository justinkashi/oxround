"use client";
// Lead/Trial Kanban: New → Contacted → Trial scheduled → Trialing → Converted/Lost. (FEATURES: Growth)

import { useEffect, useState } from "react";
import { createLead, listLeads, setLeadStatus } from "@/lib/data";
import type { Lead, LeadSource, LeadStatus } from "@/lib/types";

const COLUMNS: { status: LeadStatus; label: string; color: string }[] = [
  { status: "new", label: "New", color: "border-t-blue-400" },
  { status: "contacted", label: "Contacted", color: "border-t-yellow-400" },
  { status: "trial_scheduled", label: "Trial booked", color: "border-t-purple-400" },
  { status: "trialing", label: "Trialing", color: "border-t-orange-400" },
  { status: "converted", label: "Converted", color: "border-t-green-500" },
  { status: "lost", label: "Lost", color: "border-t-neutral-300" },
];

const SOURCES: LeadSource[] = ["walk_in", "referral", "instagram", "tiktok", "facebook", "youtube", "website", "fight_event", "other"];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", source: "walk_in" as LeadSource, notes: "" });

  const load = async () => setLeads(await listLeads());
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLead(form);
    setForm({ first_name: "", last_name: "", email: "", phone: "", source: "walk_in", notes: "" });
    setShowForm(false);
    load();
  };

  const move = async (lead: Lead, dir: 1 | -1) => {
    const order = COLUMNS.map((c) => c.status);
    const i = order.indexOf(lead.status) + dir;
    if (i < 0 || i >= order.length) return;
    await setLeadStatus(lead.id, order[i]);
    load();
  };

  const markLost = async (lead: Lead) => {
    await setLeadStatus(lead.id, "lost");
    load();
  };

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leads</h1>
        <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New lead</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-6 grid grid-cols-6 gap-3 rounded-lg border border-neutral-200 bg-white p-4">
          <input required placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
            {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Add</button>
          <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="col-span-6 rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        </form>
      )}

      <div className="grid grid-cols-6 gap-3">
        {COLUMNS.map((col) => {
          const items = leads.filter((l) => l.status === col.status);
          return (
            <div key={col.status} className={`rounded-lg border border-neutral-200 border-t-4 bg-neutral-50 p-2 ${col.color}`}>
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase text-neutral-500">{col.label}</span>
                <span className="rounded-full bg-neutral-200 px-2 text-xs font-medium text-neutral-600">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((l) => (
                  <div key={l.id} className="rounded-md border border-neutral-200 bg-white p-2 text-xs shadow-sm">
                    <div className="font-semibold">{l.first_name} {l.last_name}</div>
                    {l.source && <div className="mt-0.5 text-neutral-400">via {l.source.replace("_", " ")}</div>}
                    {l.notes && <div className="mt-1 text-neutral-600">{l.notes}</div>}
                    {l.follow_up_date && (
                      <div className={`mt-1 font-medium ${l.follow_up_date <= todayISO ? "text-red-600" : "text-neutral-500"}`}>
                        follow up {l.follow_up_date}{l.follow_up_date <= todayISO && " ⚠"}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <button onClick={() => move(l, -1)} disabled={col.status === "new"} className="text-neutral-400 hover:text-neutral-700 disabled:opacity-20">←</button>
                      {col.status !== "converted" && col.status !== "lost" && (
                        <button onClick={() => markLost(l)} className="text-neutral-300 hover:text-red-600">lost</button>
                      )}
                      <button onClick={() => move(l, 1)} disabled={col.status === "lost"} className="text-neutral-400 hover:text-neutral-700 disabled:opacity-20">→</button>
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div className="py-3 text-center text-xs text-neutral-300">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
