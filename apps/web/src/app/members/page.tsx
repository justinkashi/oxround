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
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });

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
    await createMember(form);
    // D-24: email the new member an activation link (no-op in demo mode).
    if (form.email) {
      const r = await inviteMemberEmail(form.email);
      if (!r.ok) console.warn("invite email failed:", r.error);
    }
    setForm({ first_name: "", last_name: "", email: "", phone: "" });
    setShowForm(false);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Members</h1>
        <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          + Add member
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-5">
          {(["first_name", "last_name", "email", "phone"] as const).map((f) => (
            <input
              key={f}
              required={f === "first_name"}
              placeholder={f.replace("_", " ")}
              value={form[f]}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          ))}
          <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Create</button>
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
