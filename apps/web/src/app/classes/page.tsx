"use client";
// Class scheduling: weekly grid, create class, cancel session, roster link. (FEATURES: Class Scheduling)

import { useEffect, useState } from "react";
import {
  createClass, deactivateClass, listClasses, listCoaches, updateClass,
  type ClassTemplateInput,
} from "@/lib/data";
import type { GymClass, GymMember } from "@/lib/types";
import DestructiveActionModal from "@/components/DestructiveActionModal";
import { useFormat, useT } from "@/lib/i18n";

const COLOR_CLASSES: Record<string, string> = {
  red: "border-red-300 bg-red-50",
  blue: "border-blue-300 bg-blue-50",
  green: "border-green-300 bg-green-50",
  yellow: "border-yellow-300 bg-yellow-50",
  purple: "border-purple-300 bg-purple-50",
};

type ClassForm = {
  name: string;
  description: string;
  coach_id: string;
  start_time: string;
  duration_mins: number;
  capacity: number;
  color: string;
  days: number[];
};

const blankClassForm = (): ClassForm => ({
  name: "",
  description: "",
  coach_id: "",
  start_time: "18:00",
  duration_mins: 60,
  capacity: 16,
  color: "red",
  days: [],
});

function inputFromForm(form: ClassForm): ClassTemplateInput {
  return {
    name: form.name,
    description: form.description || null,
    coach_id: form.coach_id || null,
    day_of_week: form.days,
    start_time: form.start_time,
    duration_mins: Number(form.duration_mins),
    capacity: Number(form.capacity) || null,
    location: null,
    color: form.color,
  };
}

function formFromClass(gymClass: GymClass): ClassForm {
  return {
    name: gymClass.name,
    description: gymClass.description ?? "",
    coach_id: gymClass.coach_id ?? "",
    start_time: gymClass.start_time.slice(0, 5),
    duration_mins: gymClass.duration_mins,
    capacity: gymClass.capacity ?? 0,
    color: gymClass.color ?? "red",
    days: gymClass.day_of_week,
  };
}

function mondayOf(offsetWeeks: number): Date {
  const t = new Date();
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + offsetWeeks * 7);
  t.setHours(0, 0, 0, 0);
  return t;
}

export default function ClassesPage() {
  const t = useT();
  const fmt = useFormat();
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [coaches, setCoaches] = useState<GymMember[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deactivating, setDeactivating] = useState<GymClass | null>(null);
  const [editing, setEditing] = useState<GymClass | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [form, setForm] = useState<ClassForm>(blankClassForm);

  const load = async () => {
    const [cls, cch] = await Promise.all([listClasses(), listCoaches()]);
    setClasses(cls);
    setCoaches(cch);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.days.length === 0) return alert(t.classes.pickDay);
    await createClass(inputFromForm(form));
    setShowForm(false);
    setForm(blankClassForm());
    load();
  };

  const saveEdit = async (fields: ClassForm) => {
    if (!editing) return;
    if (fields.days.length === 0) { setEditError(t.classes.pickDay); return; }
    setEditBusy(true);
    setEditError(null);
    try {
      await updateClass(editing.id, inputFromForm(fields));
      setEditing(null);
      load();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t.common.somethingWentWrong);
    } finally {
      setEditBusy(false);
    }
  };

  const monday = mondayOf(0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const dayLabels = days.map((d) => fmt.date(d, { weekday: "short" }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.classes.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowForm(!showForm)} className="ml-3 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">{t.classes.newClass}</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-6 space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input required placeholder={t.classes.className} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            <input placeholder={t.classes.description} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            <select value={form.coach_id} onChange={(e) => setForm({ ...form, coach_id: e.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
              <option value="">{t.classes.noCoach}</option>
              {coaches.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="text-sm">{t.classes.start} <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" /></label>
            <label className="text-sm">{t.classes.minutes} <input type="number" value={form.duration_mins} onChange={(e) => setForm({ ...form, duration_mins: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" /></label>
            <label className="text-sm">{t.classes.capacity} <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" /></label>
            <label className="text-sm">{t.classes.color}
              <select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5">
                {Object.keys(COLOR_CLASSES).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dayLabels.map((label, i) => {
              const dow = (i + 1) % 7; // Mon=1 … Sun=0
              const on = form.days.includes(dow);
              return (
                <button type="button" key={label} onClick={() => setForm({ ...form, days: on ? form.days.filter((d) => d !== dow) : [...form.days, dow] })}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${on ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"}`}>
                  {label}
                </button>
              );
            })}
            <button type="submit" className="ml-auto rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">{t.classes.createClass}</button>
          </div>
        </form>
      )}

      <h2 className="mb-3 text-lg font-semibold">{t.classes.templates}</h2>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr><th className="px-4 py-2">{t.classes.thClass}</th><th className="px-4 py-2">{t.classes.thDays}</th><th className="px-4 py-2">{t.classes.thTime}</th><th className="px-4 py-2">{t.classes.thCoach}</th><th className="px-4 py-2">{t.classes.capacity}</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {classes.map((cl) => (
              <tr key={cl.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-medium">{cl.name}<div className="text-xs font-normal text-neutral-500">{cl.description}</div></td>
                <td className="px-4 py-2">{cl.day_of_week.map((d) => dayLabels[(d + 6) % 7]).join(", ")}</td>
                <td className="px-4 py-2">{cl.start_time.slice(0, 5)} · {t.classes.minutesShort(cl.duration_mins)}</td>
                <td className="px-4 py-2">{coaches.find((c) => c.id === cl.coach_id)?.first_name ?? "—"}</td>
                <td className="px-4 py-2">{cl.capacity ?? "∞"}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => { setEditing(cl); setEditError(null); }}
                    className="mr-3 text-xs text-neutral-600 hover:text-brand">{t.common.edit}</button>
                  <button onClick={() => setDeactivating(cl)}
                    className="text-xs text-red-600 hover:underline">{t.classes.deactivate}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DestructiveActionModal
        open={!!deactivating}
        title={t.classes.deactivateTitle(deactivating?.name ?? "")}
        description={t.classes.deactivateDescription}
        actionLabel={t.classes.deactivateAction}
        confirmText={deactivating?.name}
        onConfirm={async () => { if (deactivating) { await deactivateClass(deactivating.id); load(); } }}
        onClose={() => setDeactivating(null)}
      />

      {editing && (
        <EditClassModal
          gymClass={editing}
          coaches={coaches}
          dayLabels={dayLabels}
          busy={editBusy}
          error={editError}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}

function EditClassModal({ gymClass, coaches, dayLabels, busy, error, onCancel, onSave }: {
  gymClass: GymClass;
  coaches: GymMember[];
  dayLabels: string[];
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (fields: ClassForm) => void;
}) {
  const t = useT();
  const [form, setForm] = useState<ClassForm>(() => formFromClass(gymClass));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel} role="dialog" aria-modal="true">
      <form
        onSubmit={(event) => { event.preventDefault(); onSave(form); }}
        className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold">{t.classes.editTitle(gymClass.name)}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input required placeholder={t.classes.className} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder={t.classes.description} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <select value={form.coach_id} onChange={(event) => setForm({ ...form, coach_id: event.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
            <option value="">{t.classes.noCoach}</option>
            {coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.first_name} {coach.last_name}</option>)}
          </select>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="text-sm">{t.classes.start} <input type="time" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" /></label>
          <label className="text-sm">{t.classes.minutes} <input type="number" value={form.duration_mins} onChange={(event) => setForm({ ...form, duration_mins: Number(event.target.value) })} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" /></label>
          <label className="text-sm">{t.classes.capacity} <input type="number" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: Number(event.target.value) })} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" /></label>
          <label className="text-sm">{t.classes.color}
            <select value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5">
              {Object.keys(COLOR_CLASSES).map((color) => <option key={color} value={color}>{color}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {dayLabels.map((label, index) => {
            const dayOfWeek = (index + 1) % 7;
            const selected = form.days.includes(dayOfWeek);
            return (
              <button type="button" key={label} onClick={() => setForm({ ...form, days: selected ? form.days.filter((day) => day !== dayOfWeek) : [...form.days, dayOfWeek] })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${selected ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"}`}>
                {label}
              </button>
            );
          })}
        </div>
        {error && <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">{t.common.cancel}</button>
          <button type="submit" disabled={busy || !form.name.trim()} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
            {busy ? t.common.saving : t.classes.saveClass}
          </button>
        </div>
      </form>
    </div>
  );
}
