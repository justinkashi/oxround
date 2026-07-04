"use client";
// Membership plans: list, create, activate/deactivate. (FEATURES: Membership Plans)

import { useEffect, useState } from "react";
import { createPlan, listPlans, setPlanActive } from "@/lib/data";
import type { MembershipPlan, PlanKind } from "@/lib/types";

const KINDS: { value: PlanKind; label: string }[] = [
  { value: "recurring", label: "Recurring" },
  { value: "drop_in", label: "Drop-in" },
  { value: "punch_card", label: "Punch card" },
  { value: "family", label: "Family" },
  { value: "trial", label: "Trial" },
  { value: "intro_offer", label: "Intro offer" },
];

const money = (cents: number | null) => (cents == null ? "—" : `$${(cents / 100).toFixed(2)}`);

export default function PlansPage() {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", kind: "recurring" as PlanKind, price: "", billing_period: "monthly" as "monthly" | "quarterly" | "annual", max_classes: "" });

  const load = async () => setPlans(await listPlans());
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const recurring = form.kind === "recurring" || form.kind === "family";
    await createPlan({
      name: form.name, kind: form.kind,
      price_cents: form.price === "" ? null : Math.round(parseFloat(form.price) * 100),
      billing_period: recurring ? form.billing_period : null,
      max_classes: form.max_classes === "" ? null : Number(form.max_classes),
    });
    setShowForm(false);
    setForm({ name: "", kind: "recurring", price: "", billing_period: "monthly", max_classes: "" });
    load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Membership Plans</h1>
        <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New plan</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-6">
          <input required placeholder="Plan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm md:col-span-2" />
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as PlanKind })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <input placeholder="Price $" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          {(form.kind === "recurring" || form.kind === "family") ? (
            <select value={form.billing_period} onChange={(e) => setForm({ ...form, billing_period: e.target.value as typeof form.billing_period })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
              <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
            </select>
          ) : (
            <input placeholder="# classes" type="number" value={form.max_classes} onChange={(e) => setForm({ ...form, max_classes: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          )}
          <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Create</button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className={`rounded-lg border bg-white p-4 ${p.is_active ? "border-neutral-200" : "border-neutral-200 opacity-50"}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs uppercase text-neutral-400">{KINDS.find((k) => k.value === p.kind)?.label}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{money(p.price_cents)}</div>
                <div className="text-xs text-neutral-500">{p.billing_period ?? (p.max_classes != null ? `${p.max_classes} classes` : "")}</div>
              </div>
            </div>
            <div className="mt-3 text-right">
              <button onClick={async () => { await setPlanActive(p.id, !p.is_active); load(); }}
                className={`text-xs hover:underline ${p.is_active ? "text-red-600" : "text-green-700"}`}>
                {p.is_active ? "deactivate" : "reactivate"}
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-neutral-400">Freeze / renew / expire actions live on each member&apos;s profile once billing goes live — plans here define what&apos;s sellable.</p>
    </div>
  );
}
