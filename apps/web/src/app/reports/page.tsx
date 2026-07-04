"use client";
// Reports: revenue by month, revenue by method, popular classes, member counts, CSV export. (FEATURES: Reports)

import { useEffect, useState } from "react";
import { attendanceSummaries, listMembers, listPayments, listSessions, bookingCounts } from "@/lib/data";
import type { MemberAttendanceSummary, GymMember, Payment } from "@/lib/types";

const money = (cents: number) => `$${(cents / 100).toFixed(0)}`;

export default function ReportsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<GymMember[]>([]);
  const [summaries, setSummaries] = useState<MemberAttendanceSummary[]>([]);
  const [classPopularity, setClassPopularity] = useState<{ name: string; booked: number }[]>([]);

  useEffect(() => {
    (async () => {
      const [p, m, s] = await Promise.all([listPayments(), listMembers(), attendanceSummaries()]);
      setPayments(p);
      setMembers(m);
      setSummaries(s);
      // popularity: bookings on this week's sessions grouped by class
      const monday = new Date();
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const ses = await listSessions(monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10));
      const counts = await bookingCounts(ses.map((x) => x.id));
      const byClass: Record<string, number> = {};
      for (const x of ses) byClass[x.class_name] = (byClass[x.class_name] ?? 0) + (counts[x.id]?.booked ?? 0);
      setClassPopularity(Object.entries(byClass).map(([name, booked]) => ({ name, booked })).sort((a, b) => b.booked - a.booked));
    })();
  }, []);

  // revenue by month (last 6)
  const byMonth: Record<string, number> = {};
  for (const p of payments) byMonth[p.paid_at.slice(0, 7)] = (byMonth[p.paid_at.slice(0, 7)] ?? 0) + p.amount_cents;
  const months = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  const maxMonth = Math.max(...months.map(([, v]) => v), 1);

  const byMethod: Record<string, number> = {};
  for (const p of payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount_cents;

  const activeMembers = members.filter((m) => m.status === "active" && m.roles.includes("member")).length;
  const atRisk = summaries.filter((s) => s.visitsPrev30 > 0 && s.visitsLast30 === 0).length;

  const exportCsv = () => {
    const rows = [["date", "member", "amount", "method", "notes"], ...payments.map((p) => [p.paid_at, p.member_name, (p.amount_cents / 100).toFixed(2), p.method, p.notes ?? ""])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "oxround-payments.csv";
    a.click();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Reports</h1>
        <button onClick={exportCsv} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">Export payments CSV</button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active members" value={String(activeMembers)} />
        <Stat label="Revenue this month" value={money(months.at(-1)?.[1] ?? 0)} />
        <Stat label="At-risk members" value={String(atRisk)} warn={atRisk > 0} />
        <Stat label="Total collected (all time)" value={money(payments.reduce((s, p) => s + p.amount_cents, 0))} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Revenue by month</h2>
          <div className="space-y-2">
            {months.map(([m, v]) => (
              <div key={m} className="flex items-center gap-2 text-sm">
                <span className="w-16 text-neutral-500">{m}</span>
                <div className="h-5 rounded bg-brand/80" style={{ width: `${(v / maxMonth) * 70}%` }} />
                <span className="font-medium">{money(v)}</span>
              </div>
            ))}
            {months.length === 0 && <div className="text-neutral-400">No payments yet</div>}
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Popular classes (this week&apos;s bookings)</h2>
          <div className="space-y-2">
            {classPopularity.map((c) => (
              <div key={c.name} className="flex items-center justify-between border-b border-neutral-100 pb-1 text-sm">
                <span>{c.name}</span><span className="font-medium">{c.booked} booked</span>
              </div>
            ))}
            {classPopularity.length === 0 && <div className="text-neutral-400">No bookings this week</div>}
          </div>
          <h2 className="mb-3 mt-6 text-sm font-semibold uppercase text-neutral-500">Revenue by method</h2>
          {Object.entries(byMethod).map(([m, v]) => (
            <div key={m} className="flex items-center justify-between border-b border-neutral-100 pb-1 text-sm">
              <span className="capitalize">{m}</span><span className="font-medium">{money(v)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Attendance leaderboard (30 days)</h2>
        <table className="w-full text-sm">
          <tbody>
            {summaries.slice(0, 8).map((s, i) => (
              <tr key={s.member.id} className="border-t border-neutral-100 first:border-t-0">
                <td className="py-1.5 pr-2 text-neutral-400">{i + 1}</td>
                <td className="py-1.5 font-medium">{s.member.first_name} {s.member.last_name}</td>
                <td className="py-1.5">{s.visitsLast30} visits</td>
                <td className="py-1.5 text-neutral-500">{s.streakWeeks}-week streak</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="text-xs uppercase text-neutral-500">{label}</div>
      <div className={`text-2xl font-bold ${warn ? "text-red-600" : ""}`}>{value}</div>
    </div>
  );
}
