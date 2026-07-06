"use client";
// Class scheduling: weekly grid, create class, cancel session, roster link. (FEATURES: Class Scheduling)

import { useEffect, useState } from "react";
import Link from "next/link";
import { bookingCounts, createClass, deactivateClass, listClasses, listCoaches, listSessions } from "@/lib/data";
import type { ClassSession, GymClass, GymMember } from "@/lib/types";
import DestructiveActionModal from "@/components/DestructiveActionModal";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLOR_CLASSES: Record<string, string> = {
  red: "border-red-300 bg-red-50",
  blue: "border-blue-300 bg-blue-50",
  green: "border-green-300 bg-green-50",
  yellow: "border-yellow-300 bg-yellow-50",
  purple: "border-purple-300 bg-purple-50",
};

function mondayOf(offsetWeeks: number): Date {
  const t = new Date();
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + offsetWeeks * 7);
  t.setHours(0, 0, 0, 0);
  return t;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function ClassesPage() {
  const [week, setWeek] = useState(0);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [counts, setCounts] = useState<Record<string, { booked: number; waitlisted: number }>>({});
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [coaches, setCoaches] = useState<GymMember[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deactivating, setDeactivating] = useState<GymClass | null>(null);
  const [form, setForm] = useState({ name: "", description: "", coach_id: "", start_time: "18:00", duration_mins: 60, capacity: 16, location: "Main floor", color: "red", days: [] as number[] });

  const load = async () => {
    const monday = mondayOf(week);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const [ses, cls, cch] = await Promise.all([listSessions(iso(monday), iso(sunday)), listClasses(), listCoaches()]);
    setSessions(ses);
    setClasses(cls);
    setCoaches(cch);
    setCounts(await bookingCounts(ses.map((s) => s.id)));
  };
  useEffect(() => { load(); }, [week]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.days.length === 0) return alert("Pick at least one day");
    await createClass({
      name: form.name, description: form.description || null, coach_id: form.coach_id || null,
      day_of_week: form.days, start_time: form.start_time, duration_mins: Number(form.duration_mins),
      capacity: Number(form.capacity) || null, location: form.location || null, color: form.color,
    });
    setShowForm(false);
    setForm({ ...form, name: "", description: "", days: [] });
    load();
  };

  const monday = mondayOf(week);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const todayISO = iso(new Date());

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Classes</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setWeek(week - 1)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">←</button>
          <span className="min-w-32 text-center text-sm font-medium">{week === 0 ? "This week" : week === 1 ? "Next week" : `Week of ${iso(monday)}`}</span>
          <button onClick={() => setWeek(week + 1)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">→</button>
          <button onClick={() => setShowForm(!showForm)} className="ml-3 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New class</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-6 space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input required placeholder="Class name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            <select value={form.coach_id} onChange={(e) => setForm({ ...form, coach_id: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
              <option value="">No coach assigned</option>
              {coaches.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <label className="text-sm">Start <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" /></label>
            <label className="text-sm">Minutes <input type="number" value={form.duration_mins} onChange={(e) => setForm({ ...form, duration_mins: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" /></label>
            <label className="text-sm">Capacity <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" /></label>
            <label className="text-sm">Location <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" /></label>
            <label className="text-sm">Color
              <select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5">
                {Object.keys(COLOR_CLASSES).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {DAY_LABELS.map((label, i) => {
              const dow = (i + 1) % 7; // Mon=1 … Sun=0
              const on = form.days.includes(dow);
              return (
                <button type="button" key={label} onClick={() => setForm({ ...form, days: on ? form.days.filter((d) => d !== dow) : [...form.days, dow] })}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${on ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"}`}>
                  {label}
                </button>
              );
            })}
            <button type="submit" className="ml-auto rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Create class</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((d, i) => {
          const dayISO = iso(d);
          const daySessions = sessions.filter((s) => s.session_date === dayISO);
          return (
            <div key={dayISO} className={`rounded-lg border p-2 ${dayISO === todayISO ? "border-brand bg-red-50/40" : "border-neutral-200 bg-white"}`}>
              <div className="mb-2 text-center text-xs font-semibold uppercase text-neutral-500">{DAY_LABELS[i]} <span className="text-neutral-400">{d.getDate()}</span></div>
              <div className="space-y-2">
                {daySessions.map((s) => {
                  const c = counts[s.id] ?? { booked: 0, waitlisted: 0 };
                  return (
                    <Link key={s.id} href={`/classes/session?id=${s.id}`}
                      className={`block rounded-md border p-2 text-xs hover:shadow ${s.status === "canceled" ? "border-neutral-200 bg-neutral-100 opacity-60" : COLOR_CLASSES[s.color ?? "red"] ?? COLOR_CLASSES.red}`}>
                      <div className="font-semibold">{s.class_name}{s.status === "canceled" && " (canceled)"}</div>
                      <div className="text-neutral-600">{s.start_time.slice(0, 5)} · {s.duration_mins}m</div>
                      <div className="text-neutral-600">{s.coach_name}</div>
                      <div className="mt-1 font-medium">
                        {s.capacity != null ? `${c.booked}/${s.capacity}` : `${c.booked} in`}
                        {c.waitlisted > 0 && <span className="text-yellow-700"> +{c.waitlisted} WL</span>}
                      </div>
                    </Link>
                  );
                })}
                {daySessions.length === 0 && <div className="py-4 text-center text-xs text-neutral-300">—</div>}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Class templates</h2>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr><th className="px-4 py-2">Class</th><th className="px-4 py-2">Days</th><th className="px-4 py-2">Time</th><th className="px-4 py-2">Coach</th><th className="px-4 py-2">Capacity</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {classes.map((cl) => (
              <tr key={cl.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-medium">{cl.name}<div className="text-xs font-normal text-neutral-500">{cl.description}</div></td>
                <td className="px-4 py-2">{cl.day_of_week.map((d) => DAY_LABELS[(d + 6) % 7]).join(", ")}</td>
                <td className="px-4 py-2">{cl.start_time.slice(0, 5)} · {cl.duration_mins}m</td>
                <td className="px-4 py-2">{coaches.find((c) => c.id === cl.coach_id)?.first_name ?? "—"}</td>
                <td className="px-4 py-2">{cl.capacity ?? "∞"}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => setDeactivating(cl)}
                    className="text-xs text-red-600 hover:underline">deactivate</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DestructiveActionModal
        open={!!deactivating}
        title={`Deactivate ${deactivating?.name ?? ""}?`}
        description="Future sessions are removed from the schedule. Past attendance history is kept. You can recreate the class later."
        actionLabel="Deactivate class"
        confirmText={deactivating?.name}
        onConfirm={async () => { if (deactivating) { await deactivateClass(deactivating.id); load(); } }}
        onClose={() => setDeactivating(null)}
      />
    </div>
  );
}
