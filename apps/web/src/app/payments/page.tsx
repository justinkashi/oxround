"use client";
// Manual payments: record cash/e-transfer/card, payment history, daily total. (FEATURES: Manual Payments)

import { useEffect, useState } from "react";
import { listMembers, listPayments, recordPayment } from "@/lib/data";
import type { GymMember, Payment } from "@/lib/types";
import { useFormat, useT } from "@/lib/i18n";

export default function PaymentsPage() {
  const t = useT();
  const fmt = useFormat();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<GymMember[]>([]);
  const [form, setForm] = useState({ gym_member_id: "", amount: "", method: "etransfer" as Payment["method"], notes: "" });

  const load = async () => {
    const [p, m] = await Promise.all([listPayments(), listMembers()]);
    setPayments(p);
    setMembers(m);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await recordPayment({
      gym_member_id: form.gym_member_id,
      amount_cents: Math.round(parseFloat(form.amount) * 100),
      method: form.method,
      notes: form.notes || null,
    });
    setForm({ gym_member_id: "", amount: "", method: "etransfer", notes: "" });
    load();
  };

  const todayISO = new Date().toISOString().slice(0, 10);
  const monthISO = todayISO.slice(0, 7);
  const todayTotal = payments.filter((p) => p.paid_at === todayISO).reduce((s, p) => s + p.amount_cents, 0);
  const monthTotal = payments.filter((p) => p.paid_at.startsWith(monthISO)).reduce((s, p) => s + p.amount_cents, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t.payments.title}</h1>
        <div className="flex gap-6 text-sm">
          <div><span className="text-neutral-500">{t.payments.today}</span> <span className="font-bold">{fmt.money(todayTotal / 100)}</span></div>
          <div><span className="text-neutral-500">{t.payments.thisMonth}</span> <span className="font-bold">{fmt.money(monthTotal / 100)}</span></div>
        </div>
      </div>

      <form onSubmit={submit} className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-5">
        <select required value={form.gym_member_id} onChange={(e) => setForm({ ...form, gym_member_id: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
          <option value="">{t.payments.memberSelect}</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
        </select>
        <input required placeholder={t.payments.amountPlaceholder} type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as Payment["method"] })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
          <option value="etransfer">{t.labels.paymentMethod.etransfer}</option><option value="cash">{t.labels.paymentMethod.cash}</option><option value="card">{t.labels.paymentMethod.card}</option><option value="other">{t.labels.paymentMethod.other}</option>
        </select>
        <input placeholder={t.payments.notePlaceholder} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">{t.payments.recordPayment}</button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr><th className="px-4 py-2">{t.payments.date}</th><th className="px-4 py-2">{t.payments.member}</th><th className="px-4 py-2">{t.payments.amount}</th><th className="px-4 py-2">{t.payments.method}</th><th className="px-4 py-2">{t.payments.note}</th></tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 text-neutral-500">{fmt.date(p.paid_at)}</td>
                <td className="px-4 py-2 font-medium">{p.member_name}</td>
                <td className="px-4 py-2 font-medium">{fmt.money(p.amount_cents / 100)}</td>
                <td className="px-4 py-2"><MethodBadge method={p.method} /></td>
                <td className="px-4 py-2 text-neutral-500">{p.notes ?? ""}</td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-400">{t.payments.noPayments}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-neutral-400">{t.payments.hint}</p>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const t = useT();
  const colors: Record<string, string> = {
    cash: "bg-green-100 text-green-700",
    etransfer: "bg-blue-100 text-blue-700",
    card: "bg-purple-100 text-purple-700",
    other: "bg-neutral-100 text-neutral-600",
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[method]}`}>{t.labels.paymentMethod[method] ?? method}</span>;
}
