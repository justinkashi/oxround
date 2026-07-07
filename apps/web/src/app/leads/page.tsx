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
import { useFormat, useT, type Messages } from "@/lib/i18n";

const COLUMNS: { status: LeadStatus; label: keyof Messages["labels"]["leadStatus"]; color: string }[] = [
  { status: "new", label: "new", color: "border-t-blue-400" },
  { status: "contacted", label: "contacted", color: "border-t-yellow-400" },
  { status: "trial_scheduled", label: "trial_scheduled", color: "border-t-purple-400" },
  { status: "trialing", label: "trialing", color: "border-t-orange-400" },
  { status: "converted", label: "converted", color: "border-t-green-500" },
  { status: "lost", label: "lost", color: "border-t-neutral-300" },
];

const SOURCES: LeadSource[] = ["walk_in", "referral", "instagram", "tiktok", "facebook", "youtube", "website", "fight_event", "other"];

export default function LeadsPage() {
  const t = useT();
  const fmt = useFormat();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [converting, setConverting] = useState<Lead | null>(null);
  const [startingTrial, setStartingTrial] = useState<Lead | null>(null);
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
  }, { successMessage: t.leads.added });

  const move = async (lead: Lead, dir: 1 | -1) => {
    const order = COLUMNS.map((c) => c.status);
    const i = order.indexOf(lead.status) + dir;
    if (i < 0 || i >= order.length) return;
    // Guardrail (Twenty transfer): entering Converted goes through the convert flow.
    if (order[i] === "converted") { setConverting(lead); return; }
    if (order[i] === "trialing" && (!lead.trial_start || !lead.trial_end)) { setStartingTrial(lead); return; }
    await setLeadStatus(lead.id, order[i]);
    load();
  };

  const markLost = async (lead: Lead) => {
    await setLeadStatus(lead.id, "lost");
    load();
  };

  const todayISO = new Date().toISOString().slice(0, 10);
  const money = (cents: number) => fmt.money(cents / 100).replace(/\.00$/, "");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.leads.title}</h1>
        <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">{t.leads.newLead}</button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); submitLead(); }} className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-6">
          <input required placeholder={t.leads.firstName} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder={t.leads.lastName} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder={t.leads.email} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder={t.leads.phone} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
            {SOURCES.map((s) => <option key={s} value={s}>{t.labels.leadSource[s]}</option>)}
          </select>
          <input placeholder={t.leads.value} inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder={t.leads.notes} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm sm:col-span-2 md:col-span-5" />
          <button type="submit" disabled={submitting} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{submitting ? t.leads.adding : t.common.add}</button>
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
                <span className="text-xs font-semibold uppercase text-neutral-500">{t.labels.leadStatus[col.label]}</span>
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
                    {l.source && <div className="mt-0.5 text-neutral-400">{t.leads.via(t.labels.leadSource[l.source])}</div>}
                    {l.notes && <div className="mt-1 text-neutral-600">{l.notes}</div>}
                    {l.status === "trialing" && l.trial_start && l.trial_end && (
                      <TrialBadge lead={l} />
                    )}
                    {l.follow_up_date && (
                      <div className={`mt-1 font-medium ${l.follow_up_date <= todayISO ? "text-red-600" : "text-neutral-500"}`}>
                        {t.leads.followUp(l.follow_up_date, l.follow_up_date <= todayISO)}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <button onClick={() => move(l, -1)} disabled={col.status === "new"} className="text-neutral-400 hover:text-neutral-700 disabled:opacity-20">←</button>
                      {col.status !== "converted" && col.status !== "lost" && (
                        <button onClick={() => markLost(l)} className="text-neutral-300 hover:text-red-600">{t.leads.lost}</button>
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
      {startingTrial && (
        <StartTrialModal
          lead={startingTrial}
          onClose={() => setStartingTrial(null)}
          onDone={() => { setStartingTrial(null); load(); }}
        />
      )}
    </div>
  );
}

function daysBetween(start: string, end: string): number {
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  return Math.floor((endTime - startTime) / 86400000);
}

function trialDates(length: number): { start: string; end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + Math.max(1, length) - 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function trialStatus(lead: Lead) {
  if (!lead.trial_start || !lead.trial_end) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${lead.trial_end}T00:00:00`);
  const total = daysBetween(lead.trial_start, lead.trial_end) + 1;
  const day = Math.max(1, Math.min(total, daysBetween(lead.trial_start, today.toISOString().slice(0, 10)) + 1));
  const remaining = daysBetween(today.toISOString().slice(0, 10), lead.trial_end);
  return { day, total, remaining, expired: today > end };
}

function TrialBadge({ lead }: { lead: Lead }) {
  const t = useT();
  const status = trialStatus(lead);
  if (!status) return null;
  const color = status.expired ? "bg-red-50 text-red-700" : status.remaining <= 2 ? "bg-yellow-50 text-yellow-800" : "bg-green-50 text-green-700";
  return (
    <div className={`mt-2 rounded px-2 py-1 font-medium ${color}`}>
      {status.expired ? t.leads.trialExpired : t.leads.trialDay(status.day, status.total)}
    </div>
  );
}

function StartTrialModal({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [length, setLength] = useState(7);
  const { submitting, run } = useSubmit(async () => {
    await setLeadStatus(lead.id, "trialing", trialDates(length));
    notify("success", t.leads.trialStarted(lead.first_name, length));
    onDone();
  });
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-lg font-semibold">{t.leads.startTrialTitle(lead.first_name)}</h2>
        <label className="mt-4 block text-sm font-medium">
          {t.leads.trialLength}
          <select value={length} onChange={(event) => setLength(Number(event.target.value))} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
            {[3, 7, 14, 30].map((days) => <option key={days} value={days}>{t.leads.trialDays(days)}</option>)}
          </select>
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} disabled={submitting} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">{t.common.cancel}</button>
          <button onClick={() => run()} disabled={submitting} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40">
            {submitting ? t.common.saving : t.leads.startTrial}
          </button>
        </div>
      </div>
    </div>
  );
}

// Guardrail modal: converting a lead creates the member (pending membership,
// D-24) and links the lead → no more "converted" leads that never became members.
function ConvertLeadModal({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const { submitting, run } = useSubmit(async () => {
    const member = await convertLeadToMember(lead);
    notify("success", t.leads.convertedToast(member.first_name));
    onDone();
  });
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{t.leads.convertTitle(lead.first_name)}</h2>
        <p className="mt-2 text-sm text-neutral-600">
          {t.leads.convertBodyBefore} ({lead.email ?? t.leads.noEmail} · {lead.phone ?? t.leads.noPhone}), {t.leads.convertBodyAfter}{" "}
          <strong>{t.leads.unpaidPending}</strong>, {t.leads.convertBodyEnd}{" "}
          <Link href="/payments" className="mx-1 text-brand underline">{t.leads.paymentsLink}</Link>{t.leads.convertBodyFinal}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} disabled={submitting} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">{t.common.cancel}</button>
          <button onClick={() => run()} disabled={submitting} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-40">
            {submitting ? t.leads.converting : t.leads.convertAction}
          </button>
        </div>
      </div>
    </div>
  );
}
