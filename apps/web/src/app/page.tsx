"use client";
// C1 Dashboard: stats + live check-in feed (A2). In real mode the feed subscribes
// to Supabase Realtime on check_ins; in demo mode it polls session state.

import { useEffect, useState } from "react";
import { attendanceSummaries, isDemoMode, listCheckIns, listMembers, supabase } from "@/lib/data";
import type { CheckIn, MemberAttendanceSummary } from "@/lib/types";

export default function Dashboard() {
  const [feed, setFeed] = useState<CheckIn[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [summaries, setSummaries] = useState<MemberAttendanceSummary[]>([]);

  useEffect(() => {
    const load = async () => {
      setFeed(await listCheckIns(20));
      setMemberCount((await listMembers()).length);
      setSummaries(await attendanceSummaries());
    };
    load();
    if (!isDemoMode) {
      const ch = supabase()
        .channel("check_ins_feed")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "check_ins" }, load)
        .subscribe();
      return () => { supabase().removeChannel(ch); };
    }
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  const today = feed.filter((c) => new Date(c.checked_in_at).toDateString() === new Date().toDateString());
  const atRisk = summaries.filter((s) => s.visitsPrev30 > 0 && s.visitsLast30 < s.visitsPrev30 / 2);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <div className="mb-8 grid grid-cols-3 gap-4">
        <Stat label="Active members" value={memberCount} />
        <Stat label="Check-ins today" value={today.length} />
        <Stat label="At-risk members" value={atRisk.length} accent={atRisk.length > 0} />
      </div>

      {atRisk.length > 0 && (
        <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-1 font-semibold text-amber-900">⚠️ Attendance dropped — reach out before they cancel</h2>
          <p className="mb-2 text-sm text-amber-800">
            These members trained half as much this month as last month. This is where memberships are lost.
          </p>
          <ul className="text-sm text-amber-900">
            {atRisk.map((s) => (
              <li key={s.member.id}>
                <a href={`/members/view?id=${s.member.id}`} className="font-medium underline">
                  {s.member.first_name} {s.member.last_name}
                </a>{" "}
                — {s.visitsPrev30} visits last month → {s.visitsLast30} this month
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mb-3 font-semibold">Live check-in feed</h2>
      <div className="rounded-lg border border-neutral-200 bg-white">
        {feed.length === 0 && <p className="p-4 text-sm text-neutral-500">No check-ins yet.</p>}
        {feed.map((c) => (
          <div key={c.id} className="flex items-center justify-between border-b border-neutral-100 px-4 py-2 last:border-0">
            <span className="text-sm font-medium">{c.member_name}</span>
            <span className="text-xs text-neutral-500">
              {new Date(c.checked_in_at).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              {" · "}{c.method.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border bg-white p-4 ${accent ? "border-amber-300" : "border-neutral-200"}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-neutral-500">{label}</div>
    </div>
  );
}
