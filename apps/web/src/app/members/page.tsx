"use client";
// C2 Member management: list, search, filter, create. (Demo slice feature 1 / A3)

import { useEffect, useState } from "react";
import Link from "next/link";
import { createMember, getMembership, inviteMemberEmail, listMembers } from "@/lib/data";
import type { GymMember, Membership } from "@/lib/types";

export default function MembersPage() {
  const [members, setMembers] = useState<GymMember[]>([]);
  const [memberships, setMemberships] = useState<Record<string, Membership | null>>({});
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", role: "member" as "member" | "coach" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    const ms = await listMembers();
    setMembers(ms);
    const entries = await Promise.all(ms.map(async (m) => [m.id, await getMembership(m.id)] as const));
    setMemberships(Object.fromEntries(entries));
  };
  useEffect(() => { load(); }, []);

  const filtered = members.filter((m) =>
    `${m.first_name} ${m.last_name ?? ""} ${m.email ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await createMember(form);
      // D-24: email the new person an activation link (member → app, coach → CRM). No-op in demo.
      if (form.email) {
        const r = await inviteMemberEmail(form.email);
        setNotice(r.ok
          ? `${form.first_name} added — invite emailed to ${form.email}.`
          : `${form.first_name} added, but the invite email didn't send (${r.error}). Deploy the invite function or invite them from Supabase.`);
      } else {
        setNotice(`${form.first_name} added (no email — they can't get an app invite until you add one).`);
      }
      setForm({ first_name: "", last_name: "", email: "", phone: "", role: "member" });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Members</h1>
        <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          + Add member
        </button>
      </div>

      {notice && <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">{notice}</div>}

      {showForm && (
        <form onSubmit={submit} className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-6">
          {(["first_name", "last_name", "email", "phone"] as const).map((f) => (
            <input
              key={f}
              required={f === "first_name"}
              type={f === "email" ? "email" : "text"}
              placeholder={f.replace("_", " ")}
              value={form[f]}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          ))}
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "member" | "coach" })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
            <option value="member">Member</option>
            <option value="coach">Coach</option>
          </select>
          <button type="submit" disabled={busy} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Adding…" : "Create"}</button>
          {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 sm:col-span-2 md:col-span-6">{error}</p>}
          <p className="text-xs text-neutral-400 sm:col-span-2 md:col-span-6">Member → gets the member app. Coach → gets the CRM (restricted). An invite email is sent if you provide one.</p>
        </form>
      )}

      <input
        placeholder="Search members…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Payment</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const s = memberships[m.id];
              return (
                <tr key={m.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <Link href={`/members/view?id=${m.id}`} className="font-medium text-brand hover:underline">
                      {m.first_name} {m.last_name}
                    </Link>
                    {m.roles.includes("coach") && <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">coach</span>}
                  </td>
                  <td className="px-4 py-2">{s?.plan_name ?? "—"}</td>
                  <td className="px-4 py-2"><PaymentBadge status={s?.payment_status} /></td>
                  <td className="px-4 py-2">{m.status}</td>
                  <td className="px-4 py-2 text-neutral-500">{m.joined_at ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-neutral-400">—</span>;
  const colors: Record<string, string> = {
    paid: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    overdue: "bg-red-100 text-red-700",
    comped: "bg-neutral-100 text-neutral-600",
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status]}`}>{status}</span>;
}
