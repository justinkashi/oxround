"use client";
// C1 Dashboard: stats + live check-in feed (A2).

import { useEffect, useState } from "react";
import { attendanceSummaries, listCheckIns, listMembers, supabase } from "@/lib/data";
import type { CheckIn, MemberAttendanceSummary } from "@/lib/types";
import { useFormat, useT } from "@/lib/i18n";

export default function Dashboard() {
  const t = useT();
  const fmt = useFormat();
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
    const ch = supabase()
      .channel("check_ins_feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "check_ins" }, load)
      .subscribe();
    return () => { supabase().removeChannel(ch); };
  }, []);

  const today = feed.filter((c) => new Date(c.checked_in_at).toDateString() === new Date().toDateString());
  const atRisk = summaries.filter((s) => s.visitsPrev30 > 0 && s.visitsLast30 < s.visitsPrev30 / 2);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t.dashboard.title}</h1>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label={t.dashboard.activeMembers} value={memberCount} />
        <Stat label={t.dashboard.checkInsToday} value={today.length} />
        <Stat label={t.dashboard.atRiskMembers} value={atRisk.length} accent={atRisk.length > 0} />
      </div>

      {atRisk.length > 0 && (
        <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-1 font-semibold text-amber-900">{t.dashboard.atRiskTitle}</h2>
          <p className="mb-2 text-sm text-amber-800">{t.dashboard.atRiskBody}</p>
          <ul className="text-sm text-amber-900">
            {atRisk.map((s) => (
              <li key={s.member.id}>
                <a href={`/members/view?id=${s.member.id}`} className="font-medium underline">
                  {s.member.first_name} {s.member.last_name}
                </a>{" "}
                — {t.dashboard.atRiskLine(s.visitsPrev30, s.visitsLast30)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mb-3 font-semibold">{t.dashboard.liveFeed}</h2>
      <div className="rounded-lg border border-neutral-200 bg-white">
        {feed.length === 0 && <p className="p-4 text-sm text-neutral-500">{t.dashboard.noCheckIns}</p>}
        {feed.map((c) => (
          <div key={c.id} className="flex items-center justify-between border-b border-neutral-100 px-4 py-2 last:border-0">
            <span className="text-sm font-medium">{c.member_name}</span>
            <span className="text-xs text-neutral-500">
              {fmt.dateTime(c.checked_in_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              {" · "}{t.dashboard.method[c.method] ?? c.method}
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
