"use client";
// Coach management: staff list + full coach profile (contact, roles, weekly
// availability, classes run, add/remove). (FEATURES: Coach Management)

import { useEffect, useState } from "react";
import {
  createMember, inviteMemberEmail, listClasses, listCoaches, setMemberRoles, updateMember,
  type MemberProfileUpdate,
} from "@/lib/data";
import type { AvailabilityWindow, GymClass, GymMember, Role } from "@/lib/types";
import DestructiveActionModal from "@/components/DestructiveActionModal";
import { useFormat, useT } from "@/lib/i18n";

type CoachForm = { first_name: string; last_name: string; email: string; phone: string; invite: boolean };
const blankCoachForm = (): CoachForm => ({ first_name: "", last_name: "", email: "", phone: "", invite: false });

// Jan 1 2023 was a Sunday → gives a stable date for each weekday index (0=Sun … 6=Sat).
function weekdayDate(day: number): Date {
  return new Date(2023, 0, 1 + day);
}

export default function CoachesPage() {
  const t = useT();
  const fmt = useFormat();
  const [coaches, setCoaches] = useState<GymMember[]>([]);
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState(blankCoachForm);
  const [newBusy, setNewBusy] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<GymMember | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = async () => {
    const [cs, cl] = await Promise.all([listCoaches(), listClasses()]);
    setCoaches(cs);
    setClasses(cl);
  };
  useEffect(() => { load(); }, []);

  const classesFor = (coachId: string) => classes.filter((c) => c.coach_id === coachId);
  const weekdayShort = (day: number) => fmt.date(weekdayDate(day), { weekday: "short" });

  const createCoach = async (event: React.FormEvent) => {
    event.preventDefault();
    setNewBusy(true);
    setNewError(null);
    setNotice(null);
    try {
      const coach = await createMember({ ...newForm, role: "coach" });
      if (!newForm.email) {
        setNotice(t.coaches.createdNoEmail(coach.first_name));
      } else if (newForm.invite) {
        const result = await inviteMemberEmail(newForm.email);
        setNotice(result.ok ? t.coaches.createdInviteSent(coach.first_name, newForm.email) : t.coaches.createdInviteFailed(coach.first_name, result.error ?? ""));
      } else {
        setNotice(t.coaches.createdNoInvite(coach.first_name));
      }
      setNewForm(blankCoachForm());
      setShowNew(false);
      load();
    } catch (error) {
      setNewError(error instanceof Error ? error.message : t.common.somethingWentWrong);
    } finally {
      setNewBusy(false);
    }
  };

  const saveEdit = async (fields: MemberProfileUpdate, roles: Role[]) => {
    if (!editing) return;
    setEditBusy(true);
    setEditError(null);
    setNotice(null);
    try {
      await updateMember(editing.id, fields);
      // Roles live on a separate column / RLS path — only write if they changed.
      if (JSON.stringify(roles) !== JSON.stringify(editing.roles)) await setMemberRoles(editing.id, roles);
      setNotice(t.coaches.updated(fields.first_name));
      setEditing(null);
      load();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t.common.somethingWentWrong);
    } finally {
      setEditBusy(false);
    }
  };

  const [demoting, setDemoting] = useState<GymMember | null>(null);
  const demote = async (m: GymMember) => {
    await setMemberRoles(m.id, m.roles.filter((r) => r !== "coach"));
    load();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.coaches.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowNew(!showNew)} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">{t.coaches.newCoach}</button>
        </div>
      </div>

      {notice && <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">{notice}</div>}

      {showNew && (
        <form onSubmit={createCoach} className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-5">
          <input required placeholder={t.members.firstName} value={newForm.first_name} onChange={(event) => setNewForm({ ...newForm, first_name: event.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder={t.members.lastName} value={newForm.last_name} onChange={(event) => setNewForm({ ...newForm, last_name: event.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input type="email" placeholder={t.members.emailOptional} value={newForm.email} onChange={(event) => setNewForm({ ...newForm, email: event.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder={t.members.phoneOptional} value={newForm.phone} onChange={(event) => setNewForm({ ...newForm, phone: event.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-neutral-600 sm:col-span-2 md:col-span-5">
            <input type="checkbox" checked={newForm.invite && !!newForm.email.trim()} disabled={!newForm.email.trim()} onChange={(event) => setNewForm({ ...newForm, invite: event.target.checked })} />
            {newForm.email.trim() ? t.members.inviteToggleLabel : t.members.inviteToggleHint}
          </label>
          <button type="submit" disabled={newBusy || !newForm.first_name.trim()} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{newBusy ? t.common.saving : t.coaches.createCoach}</button>
          {newError && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700 sm:col-span-2 md:col-span-5">{newError}</p>}
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {coaches.map((c) => {
          const runs = classesFor(c.id);
          const avail = c.availability ?? [];
          return (
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
                  <span key={r} className={`rounded px-2 py-0.5 text-xs font-medium ${r === "owner" ? "bg-neutral-900 text-white" : r === "manager" ? "bg-purple-100 text-purple-700" : r === "coach" ? "bg-blue-100 text-blue-700" : "bg-neutral-100 text-neutral-600"}`}>{t.labels.role[r] ?? r}</span>
                ))}
                {(() => {
                  const s = c.invite_status ?? "not_invited";
                  const cls: Record<string, string> = { not_invited: "bg-neutral-100 text-neutral-500", invited: "bg-yellow-100 text-yellow-700", active: "bg-green-100 text-green-700" };
                  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls[s] ?? cls.not_invited}`}>{t.labels.appJoin[s] ?? s}</span>;
                })()}
              </div>

              <dl className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">{t.coaches.classesHeading}</dt>
                  <dd className="text-right font-medium text-neutral-700">
                    {runs.length ? runs.map((r) => r.name).join(", ") : <span className="font-normal text-neutral-400">{t.coaches.noClassesAssigned}</span>}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">{t.coaches.availabilityHeading}</dt>
                  <dd className="text-right font-medium text-neutral-700">
                    {avail.length
                      ? avail.slice().sort((a, b) => a.day - b.day).map((w) => weekdayShort(w.day)).join(", ")
                      : <span className="font-normal text-neutral-400">{t.coaches.availabilityNone}</span>}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                <span>{c.phone ?? ""}</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => { setEditing(c); setEditError(null); }} className="font-medium text-neutral-600 hover:text-brand">{t.common.edit}</button>
                  {c.roles.includes("coach") && !c.roles.includes("owner") && (
                    <button onClick={() => setDemoting(c)} className="text-red-600 hover:underline">{t.coaches.removeRole}</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {coaches.length === 0 && <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-400 sm:col-span-2 lg:col-span-3">{t.coaches.noStaff}</div>}
      </div>
      <p className="mt-4 text-xs text-neutral-400">{t.coaches.hint}</p>

      <DestructiveActionModal
        open={!!demoting}
        title={t.coaches.removeTitle(demoting?.first_name ?? "")}
        description={t.coaches.removeDescription}
        actionLabel={t.coaches.removeAction}
        onConfirm={async () => { if (demoting) await demote(demoting); }}
        onClose={() => setDemoting(null)}
      />

      {editing && (
        <EditCoachModal
          coach={editing}
          classesRun={classesFor(editing.id)}
          weekdayShort={weekdayShort}
          busy={editBusy}
          error={editError}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}

const DEFAULT_START = "17:00";
const DEFAULT_END = "21:00";

function EditCoachModal({ coach, classesRun, weekdayShort, busy, error, onCancel, onSave }: {
  coach: GymMember;
  classesRun: GymClass[];
  weekdayShort: (day: number) => string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (fields: MemberProfileUpdate, roles: Role[]) => void;
}) {
  const t = useT();
  const [form, setForm] = useState({
    first_name: coach.first_name,
    last_name: coach.last_name ?? "",
    email: coach.email ?? "",
    phone: coach.phone ?? "",
  });
  const [isManager, setIsManager] = useState(coach.roles.includes("manager"));
  // Availability held as a day→window map for easy per-row editing.
  const [windows, setWindows] = useState<Record<number, { start: string; end: string }>>(() => {
    const map: Record<number, { start: string; end: string }> = {};
    for (const w of coach.availability ?? []) map[w.day] = { start: w.start, end: w.end };
    return map;
  });

  const toggleDay = (day: number) => {
    setWindows((prev) => {
      const next = { ...prev };
      if (next[day]) delete next[day];
      else next[day] = { start: DEFAULT_START, end: DEFAULT_END };
      return next;
    });
  };
  const setTime = (day: number, key: "start" | "end", value: string) => {
    setWindows((prev) => ({ ...prev, [day]: { ...prev[day], [key]: value } }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const availability: AvailabilityWindow[] = Object.entries(windows)
      .map(([day, w]) => ({ day: Number(day), start: w.start, end: w.end }))
      .sort((a, b) => a.day - b.day);
    const roles: Role[] = coach.roles.filter((r) => r !== "manager");
    if (isManager && !roles.includes("manager")) roles.push("manager");
    onSave({ ...form, availability }, roles);
  };

  const isOwner = coach.roles.includes("owner");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel} role="dialog" aria-modal="true">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold">{t.coaches.editCoach}</h2>

        {/* Contact */}
        <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">{t.coaches.contactHeading}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input required placeholder={t.members.firstName} value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder={t.members.lastName} value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input type="email" placeholder={t.members.emailOptional} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm sm:col-span-2" />
          <input placeholder={t.members.phoneOptional} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm sm:col-span-2" />
        </div>

        {/* Roles */}
        <h3 className="mb-2 mt-5 text-xs font-semibold uppercase text-neutral-500">{t.coaches.rolesHeading}</h3>
        {isOwner ? (
          <p className="text-sm text-neutral-500">{t.coaches.ownerLocked}</p>
        ) : (
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={isManager} onChange={(e) => setIsManager(e.target.checked)} />
            {t.coaches.managerRole}
          </label>
        )}

        {/* Availability */}
        <h3 className="mb-1 mt-5 text-xs font-semibold uppercase text-neutral-500">{t.coaches.availabilityHeading}</h3>
        <p className="mb-2 text-xs text-neutral-400">{t.coaches.availabilityHint}</p>
        <div className="space-y-1.5">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => {
            const on = !!windows[day];
            return (
              <div key={day} className="flex items-center gap-3">
                <label className="flex w-24 items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" checked={on} onChange={() => toggleDay(day)} />
                  {weekdayShort(day)}
                </label>
                <input
                  type="time"
                  value={windows[day]?.start ?? DEFAULT_START}
                  disabled={!on}
                  onChange={(e) => setTime(day, "start", e.target.value)}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
                />
                <span className="text-neutral-400">–</span>
                <input
                  type="time"
                  value={windows[day]?.end ?? DEFAULT_END}
                  disabled={!on}
                  onChange={(e) => setTime(day, "end", e.target.value)}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
                />
              </div>
            );
          })}
        </div>

        {/* Classes run (read-only) */}
        <h3 className="mb-2 mt-5 text-xs font-semibold uppercase text-neutral-500">{t.coaches.classesHeading}</h3>
        {classesRun.length === 0 ? (
          <p className="text-sm text-neutral-400">{t.coaches.noClassesAssigned}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {classesRun.map((c) => (
              <span key={c.id} className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">{c.name}</span>
            ))}
          </div>
        )}

        {error && <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">{t.common.cancel}</button>
          <button type="submit" disabled={busy || !form.first_name.trim()} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
            {busy ? t.common.saving : t.members.saveChanges}
          </button>
        </div>
      </form>
    </div>
  );
}
