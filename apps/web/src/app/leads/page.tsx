"use client";
// Lead/Trial Kanban: New → Contacted → Trial scheduled → Trialing → Converted/Lost.
// Twenty-transfer upgrades: per-column $ aggregates, persisted ordering, and a
// guardrail — moving a lead to Converted creates the member in one step.

import { useEffect, useState } from "react";
import Link from "next/link";
import { convertLeadToMember, createLead, listLeads, setLeadStatus } from "@/lib/data";
import { useSubmit } from "@/lib/useSubmit";
import { notify } from "@/components/toast";
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
  const [converting, setConverting] = useState<Lead | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", source: "walk_in" as LeadSource, notes: "", value: "" });

  const load = async () => setLeads(await listLeads());
  useEffect(() => { load(); }, []);

  const { submitting, run: submitLead } = useSubmit(async () => {
    const value = form.value.trim() ? Math.round(parseFloat(form.value) * 100) : null;
    await createLead({
      first_name: form.first_name, last_name: form.last_name, email: form.email,
      phone: form.phone, source: form.source, notes: form.notes,
      ...(value != null && !Number.isNaN(value) ? { estimated_value_cents: value } : {}),
    } as Parameters<typeof createLead>[0]);
    setForm({ first_name: "", last_name: "", email: "", phone: "", source: "walk_in", notes: "", value: "" });
    setShowForm(false);
    load();
  }, { successMessage: "Lead added." });

  const move = async (lead: Lead, dir: 1 | -1) => {
    const order = COLUMNS.map((c) => c.status);
    const i = order.indexOf(lead.status) + dir;
    if (i < 0 || i >= order.length) return;
    // Guardrail (Twenty transfer): entering Converted goes through the convert flow.
    if (order[i] === "converted") { setConverting(lead); return; }
    await setLeadStatus(lead.id, order[i]);
    load();
  };

  const markLost = async (lead: Lead) => {
    await setLeadStatus(lead.id, "lost");
    load();
  };

  const todayISO = new Date().toISOString().slice(0, 10);
  const money = (cents: number) => `$${(cents / 100).toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leads</h1>
        <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New lead</button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); submitLead(); }} className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-6">
          <input required placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
            {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <input placeholder="Est. value $/mo" inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm sm:col-span-2 md:col-span-5" />
          <button type="submit" disabled={submitting} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{submitting ? "Adding…" : "Add"}</button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {COLUMNS.map((col) => {
          const items = leads
            .filter((l) => l.status === col.status)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || b.created_at.localeCompare(a.created_at));
          const value = items.reduce((sum, l) => sum + (l.estimated_value_cents ?? 0), 0);
          return (
            <div key={col.status} className={`rounded-lg border border-neutral-200 border-t-4 bg-neutral-50 p-2 ${col.color}`}>
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase text-neutral-500">{col.label}</span>
                <span className="flex items-center gap-1">
                  {value > 0 && <span className="text-xs font-medium text-green-700">{money(value)}/mo</span>}
                  <span className="rounded-full bg-neutral-200 px-2 text-xs font-medium text-neutral-600">{items.length}</span>
                </span>
              </div>
              <div className="space-y-2">
                {items.map((l) => (
                  <div key={l.id} className="rounded-md border border-neutral-200 bg-white p-2 text-xs shadow-sm">
                    <div className="flex items-start justify-between">
                      <span className="font-semibold">{l.first_name} {l.last_name}</span>
                      {l.estimated_value_cents != null && l.estimated_value_cents > 0 && (
                        <span className="text-green-700">{money(l.estimated_value_cents)}</span>
                      )}
                    </div>
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

      {converting && (
        <ConvertLeadModal
          lead={converting}
          onClose={() => setConverting(null)}
          onDone={() => { setConverting(null); load(); }}
        />
      )}
    </div>
  );
}

// Guardrail modal: converting a lead creates the member (pending membership,
// D-24) and links the lead → no more "converted" leads that never became members.
function ConvertLeadModal({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const { submitting, run } = useSubmit(async () => {
    const member = await convertLeadToMember(lead);
    notify("success", `${member.first_name} is now a member — starts unpaid/pending until their first payment.`);
    onDone();
  });
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Convert {lead.first_name} to a member?</h2>
        <p className="mt-2 text-sm text-neutral-600">
          This creates their member record ({lead.email ?? "no email"} · {lead.phone ?? "no phone"}), starts them
          as <strong>unpaid/pending</strong>, and marks the lead converted. Record their first payment on the
          <Link href="/payments" className="mx-1 text-brand underline">Payments</Link>page to activate their QR.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} disabled={submitting} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">Cancel</button>
          <button onClick={() => run()} disabled={submitting} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-40">
            {submitting ? "Converting…" : "Convert to member"}
          </button>
        </div>
      </div>
    </div>
  );
}
