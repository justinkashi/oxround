"use client";
// Coach management: staff list, promote member to coach, demote. (FEATURES: Coach Management)

import { useEffect, useState } from "react";
import { listCoaches, listMembers, setMemberRoles } from "@/lib/data";
import type { GymMember } from "@/lib/types";

export default function CoachesPage() {
  const [coaches, setCoaches] = useState<GymMember[]>([]);
  const [members, setMembers] = useState<GymMember[]>([]);
  const [promoteId, setPromoteId] = useState("");

  const load = async () => {
    const [c, m] = await Promise.all([listCoaches(), listMembers()]);
    setCoaches(c);
    setMembers(m);
  };
  useEffect(() => { load(); }, []);

  const promote = async () => {
    const m = members.find((x) => x.id === promoteId);
    if (!m) return;
    await setMemberRoles(m.id, Array.from(new Set([...m.roles, "coach" as const])));
    setPromoteId("");
    load();
  };

  const demote = async (m: GymMember) => {
    if (!confirm(`Remove coach role from ${m.first_name}?`)) return;
    await setMemberRoles(m.id, m.roles.filter((r) => r !== "coach"));
    load();
  };

  const promotable = members.filter((m) => !m.roles.includes("coach") && !m.roles.includes("owner"));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Coaches & Staff</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select value={promoteId} onChange={(e) => setPromoteId(e.target.value)} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
            <option value="">Promote a member…</option>
            {promotable.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
          </select>
          <button disabled={!promoteId} onClick={promote} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Make coach</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {coaches.map((c) => (
          <div key={c.id} className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-1 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white">
                {c.first_name[0]}{(c.last_name ?? " ")[0]}
              </div>
              <div>
                <div className="font-semibold">{c.first_name} {c.last_name}</div>
                <div className="text-xs text-neutral-500">{c.email ?? "—"}</div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {c.roles.map((r) => (
                <span key={r} className={`rounded px-2 py-0.5 text-xs font-medium ${r === "owner" ? "bg-neutral-900 text-white" : r === "coach" ? "bg-blue-100 text-blue-700" : "bg-neutral-100 text-neutral-600"}`}>{r}</span>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
              <span>{c.phone ?? ""}</span>
              {c.roles.includes("coach") && !c.roles.includes("owner") && (
                <button onClick={() => demote(c)} className="text-red-600 hover:underline">remove coach role</button>
              )}
            </div>
          </div>
        ))}
        {coaches.length === 0 && <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-400 sm:col-span-2 lg:col-span-3">No staff yet</div>}
      </div>
      <p className="mt-4 text-xs text-neutral-400">Role permissions (owner / manager / coach / receptionist) are enforced server-side once deployed — this screen manages who holds which role.</p>
    </div>
  );
}
