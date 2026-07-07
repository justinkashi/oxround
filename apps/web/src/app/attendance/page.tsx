"use client";
// A2 Logs dashboard + the "show user-loss in numbers" view (logs.md July 2).
// Member-level: last 30 days, streak, total. Gym-level: busiest days, trend, at-risk list.

import { useEffect, useState } from "react";
import Link from "next/link";
import { attendanceSummaries, listCheckIns } from "@/lib/data";
import type { CheckIn, MemberAttendanceSummary } from "@/lib/types";
import { useFormat, useT } from "@/lib/i18n";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AttendancePage() {
  const t = useT();
  const fmt = useFormat();
  const [summaries, setSummaries] = useState<MemberAttendanceSummary[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);

  useEffect(() => {
    attendanceSummaries().then(setSummaries);
    listCheckIns(2000).then(setCheckIns);
  }, []);

  const byDay = DAY_NAMES.map((name, i) => ({
    name,
    count: checkIns.filter((c) => new Date(c.checked_in_at).getDay() === i).length,
  }));
  const maxDay = Math.max(1, ...byDay.map((d) => d.count));

  const thisMonth = summaries.reduce((n, s) => n + s.visitsLast30, 0);
  const lastMonth = summaries.reduce((n, s) => n + s.visitsPrev30, 0);
  const atRisk = summaries.filter((s) => s.visitsPrev30 > 0 && s.visitsLast30 < s.visitsPrev30 / 2);
  // logs.md: "demonstrate how important user loss is with numbers"
  const avgMembershipCents = 12900;
  const revenueAtRisk = (atRisk.length * avgMembershipCents) / 100;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t.attendance.title}</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="text-3xl font-bold">{thisMonth}</div>
          <div className="text-sm text-neutral-500">
            {t.attendance.visitsLast30} {lastMonth > 0 && (
              <span className={thisMonth >= lastMonth ? "text-green-600" : "text-red-600"}>
                {t.attendance.vsPrior(`${thisMonth >= lastMonth ? "+" : ""}${(((thisMonth - lastMonth) / lastMonth) * 100).toFixed(0)}`)}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="text-3xl font-bold text-amber-900">{atRisk.length}</div>
          <div className="text-sm text-amber-800">{t.attendance.quietMembers}</div>
        </div>
        <div className="rounded-lg border border-red-300 bg-red-50 p-4">
          <div className="text-3xl font-bold text-red-900">{fmt.money(revenueAtRisk)}{t.common.perMonth}</div>
          <div className="text-sm text-red-800">{t.attendance.revenueRisk}</div>
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">{t.attendance.busiestDays}</h2>
        <div className="flex items-end gap-3">
          {byDay.map((d) => (
            <div key={d.name} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t bg-brand/80" style={{ height: `${(d.count / maxDay) * 120}px`, minHeight: 2 }} />
              <span className="text-xs text-neutral-500">{fmt.date(new Date(2026, 0, 4 + DAY_NAMES.indexOf(d.name)), { weekday: "short" })}</span>
              <span className="text-xs font-medium">{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="mb-3 font-semibold">{t.attendance.perMember}</h2>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">{t.attendance.member}</th>
              <th className="px-4 py-2">{t.attendance.last30}</th>
              <th className="px-4 py-2">{t.attendance.prior30}</th>
              <th className="px-4 py-2">{t.attendance.trend}</th>
              <th className="px-4 py-2">{t.attendance.streak}</th>
              <th className="px-4 py-2">{t.attendance.lastVisit}</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => {
              const dropping = s.visitsPrev30 > 0 && s.visitsLast30 < s.visitsPrev30 / 2;
              return (
                <tr key={s.member.id} className={`border-t border-neutral-100 ${dropping ? "bg-amber-50" : ""}`}>
                  <td className="px-4 py-2">
                    <Link href={`/members/view?id=${s.member.id}`} className="font-medium text-brand hover:underline">
                      {s.member.first_name} {s.member.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{s.visitsLast30}</td>
                  <td className="px-4 py-2">{s.visitsPrev30}</td>
                  <td className="px-4 py-2">
                    {dropping ? <span className="font-medium text-amber-700">{t.attendance.dropping}</span>
                      : s.visitsLast30 > s.visitsPrev30 ? <span className="text-green-600">{t.attendance.up}</span>
                      : <span className="text-neutral-400">{t.attendance.steady}</span>}
                  </td>
                  <td className="px-4 py-2">{s.streakWeeks} {t.attendance.weekShort}</td>
                  <td className="px-4 py-2 text-neutral-500">
                    {s.lastVisit ? fmt.date(s.lastVisit, { month: "short", day: "numeric" }) : t.attendance.never}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
