"use client";
// Weekly class schedule: roster links, booking counts, and overlap-aware layout.

import { useEffect, useState } from "react";
import Link from "next/link";
import { bookingCounts, listSessions } from "@/lib/data";
import type { ClassSession } from "@/lib/types";
import { useFormat, useT } from "@/lib/i18n";

const COLOR_CLASSES: Record<string, string> = {
  red: "border-red-300 bg-red-50",
  blue: "border-blue-300 bg-blue-50",
  green: "border-green-300 bg-green-50",
  yellow: "border-yellow-300 bg-yellow-50",
  purple: "border-purple-300 bg-purple-50",
};

function mondayOf(offsetWeeks: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + offsetWeeks * 7);
  date.setHours(0, 0, 0, 0);
  return date;
}

const iso = (date: Date) => date.toISOString().slice(0, 10);

function minutes(time: string): number {
  const [hours, mins] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + mins;
}

function overlapGroups(sessions: ClassSession[]): ClassSession[][] {
  const sorted = [...sessions].sort((left, right) => minutes(left.start_time) - minutes(right.start_time));
  const groups: ClassSession[][] = [];
  let currentEnd = -1;
  for (const session of sorted) {
    const start = minutes(session.start_time);
    const end = start + session.duration_mins;
    const last = groups[groups.length - 1];
    if (!last || start >= currentEnd) {
      groups.push([session]);
      currentEnd = end;
    } else {
      last.push(session);
      currentEnd = Math.max(currentEnd, end);
    }
  }
  return groups;
}

export default function SchedulePage() {
  const t = useT();
  const fmt = useFormat();
  const [week, setWeek] = useState(0);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [counts, setCounts] = useState<Record<string, { booked: number; waitlisted: number }>>({});

  const load = async () => {
    const monday = mondayOf(week);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekSessions = await listSessions(iso(monday), iso(sunday));
    setSessions(weekSessions);
    setCounts(await bookingCounts(weekSessions.map((session) => session.id)));
  };
  useEffect(() => { load(); }, [week]); // eslint-disable-line react-hooks/exhaustive-deps

  const monday = mondayOf(week);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
  const dayLabels = days.map((day) => fmt.date(day, { weekday: "short" }));
  const todayISO = iso(new Date());

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.schedule.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setWeek(week - 1)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">←</button>
          <span className="min-w-32 text-center text-sm font-medium">{week === 0 ? t.classes.thisWeek : week === 1 ? t.classes.nextWeek : t.classes.weekOf(fmt.date(monday))}</span>
          <button onClick={() => setWeek(week + 1)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">→</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day, index) => {
          const dayISO = iso(day);
          const daySessions = sessions.filter((session) => session.session_date === dayISO);
          const groups = overlapGroups(daySessions);
          return (
            <div key={dayISO} className={`rounded-lg border p-2 ${dayISO === todayISO ? "border-brand bg-red-50/40" : "border-neutral-200 bg-white"}`}>
              <div className="mb-2 text-center text-xs font-semibold uppercase text-neutral-500">{dayLabels[index]} <span className="text-neutral-400">{day.getDate()}</span></div>
              <div className="space-y-2">
                {groups.map((group) => (
                  <div key={group.map((session) => session.id).join("-")} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${group.length}, minmax(0, 1fr))` }}>
                    {group.map((session) => {
                      const count = counts[session.id] ?? { booked: 0, waitlisted: 0 };
                      return (
                        <Link key={session.id} href={`/classes/session?id=${session.id}`}
                          className={`block min-w-0 rounded-md border p-2 text-xs hover:shadow ${session.status === "canceled" ? "border-neutral-200 bg-neutral-100 opacity-60" : COLOR_CLASSES[session.color ?? "red"] ?? COLOR_CLASSES.red}`}>
                          <div className="truncate font-semibold">{session.class_name}{session.status === "canceled" && ` (${t.classes.canceled})`}</div>
                          <div className="truncate text-neutral-600">{session.start_time.slice(0, 5)} · {t.classes.minutesShort(session.duration_mins)}</div>
                          <div className="truncate text-neutral-600">{session.coach_name}</div>
                          <div className="mt-1 truncate font-medium">
                            {session.capacity != null ? `${count.booked}/${session.capacity}` : t.classes.bookedIn(count.booked)}
                            {count.waitlisted > 0 && <span className="text-yellow-700">{t.classes.waitlistShort(count.waitlisted)}</span>}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ))}
                {daySessions.length === 0 && <div className="py-4 text-center text-xs text-neutral-300">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
