"use client";
// Fighter Card (Twenty-transfer): member profile in the 3-column record layout.
//   Left  — profile + boxing details + membership status badge + controls
//   Center — Activity Timeline / Notes / Tasks / Files tabs (tables from 0010)
//   Right — quick actions (check-in, QR, invite) + attendance stats
// Query-param route (?id=) for static-export compat.

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  addMemberNote, attachmentUrl, createTask, getMember, getMembership, inviteMemberEmail,
  listAttachments, listMemberNotes, listPlans, listTasks, memberCheckIns, memberTimeline,
  recordManualCheckIn, setMemberStatus, setMembershipPlan, setPaymentStatus, setTaskStatus, updateMember, uploadAttachment,
  type MemberProfileUpdate,
} from "@/lib/data";
import { useSubmit } from "@/lib/useSubmit";
import { notify } from "@/components/toast";
import type {
  Attachment, CheckIn, CoachNote, GymMember, GymTask, Membership, MembershipPlan, PaymentStatus, TimelineEvent,
} from "@/lib/types";
import { useFormat, useT } from "@/lib/i18n";

const PAYMENT_OPTIONS: PaymentStatus[] = ["paid", "pending", "overdue", "comped"];
type Tab = "timeline" | "notes" | "tasks" | "files";

export default function MemberViewPage() {
  return (
    <Suspense fallback={<LoadingText />}>
      <FighterCard />
    </Suspense>
  );
}

function LoadingText() {
  const t = useT();
  return <p className="text-sm text-neutral-500">{t.memberView.loading}</p>;
}

function FighterCard() {
  const t = useT();
  const fmt = useFormat();
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const [member, setMember] = useState<GymMember | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [tab, setTab] = useState<Tab>("timeline");
  const [editing, setEditing] = useState(false);

  const load = async () => {
    setMember(await getMember(id));
    setMembership(await getMembership(id));
    setCheckIns(await memberCheckIns(id));
    setPlans(await listPlans());
  };
  useEffect(() => { if (id) load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { submitting: profileSaving, run: saveProfile } = useSubmit(async (fields: MemberProfileUpdate, planId?: string) => {
    await updateMember(id, fields);
    if (planId !== undefined) await setMembershipPlan(id, planId || null);
    await load();
    setEditing(false);
  }, { successMessage: t.memberView.profileSaved });

  if (!member) return <p className="text-sm text-neutral-500">{t.memberView.loading}</p>;

  const active = member.status === "active";
  const paymentOk = !membership || membership.payment_status === "paid" || membership.payment_status === "comped";
  const current = active && paymentOk;
  const last30 = checkIns.filter((c) => Date.now() - new Date(c.checked_in_at).getTime() <= 30 * 86400000).length;
  const fr = member.fight_record;
  const age = ageFromDate(member.date_of_birth);

  return (
    <div>
      <button onClick={() => router.back()} className="mb-4 text-sm text-neutral-500 hover:underline">{t.memberView.back}</button>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)_260px]">
        {/* ============ LEFT: profile & status ============ */}
        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-lg font-bold text-white">
                {member.first_name[0]}{(member.last_name ?? " ")[0]}
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">{member.first_name} {member.last_name}</h1>
                <p className="text-xs text-neutral-500">{t.memberView.joined(member.joined_at ? fmt.date(member.joined_at) : "—")}</p>
              </div>
            </div>
            <div className={`mb-3 rounded-md px-3 py-2 text-center text-sm font-bold tracking-wide ${
              current ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {current ? t.memberView.current : active ? t.memberView.pastDue : t.memberView.inactive}
            </div>
            <dl className="space-y-1.5 text-sm">
              <Row k={t.memberView.email} v={member.email ?? "—"} />
              <Row k={t.memberView.phone} v={member.phone ?? "—"} />
              <Row k={t.memberView.plan} v={membership?.plan_name ?? t.memberView.none} />
              <Row k={t.memberView.age} v={age == null ? "—" : t.memberView.yearsOld(age)} />
              <Row k={t.memberView.dateJoined} v={member.joined_at ? fmt.date(member.joined_at) : "—"} />
              <Row k={t.memberView.nextBilling} v={membership?.next_billing_date ? fmt.date(membership.next_billing_date) : "—"} />
              <Row k={t.memberView.weightClass} v={member.weight_class ?? "—"} />
              <Row k={t.memberView.skillLevel} v={member.skill_level ?? "—"} />
              <Row k={t.memberView.record} v={fr ? `${fr.wins}-${fr.losses}-${fr.draws}` : "—"} />
            </dl>
            <button
              onClick={() => setEditing(true)}
              className="mt-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {t.memberView.editProfile}
            </button>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <label className="mb-1 block text-xs font-medium uppercase text-neutral-500">{t.memberView.paymentStatus}</label>
            <div className="mb-3 flex flex-wrap gap-2">
              {PAYMENT_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={async () => { await setPaymentStatus(id, p); load(); }}
                  className={`rounded-md border px-3 py-1 text-xs font-medium ${
                    membership?.payment_status === p ? "border-brand bg-red-50 text-brand" : "border-neutral-300 text-neutral-600"}`}
                >
                  {t.labels.paymentStatus[p]}
                </button>
              ))}
            </div>
            <button
              onClick={async () => { await setMemberStatus(id, active ? "inactive" : "active"); load(); }}
              className={`w-full rounded-md px-4 py-2 text-sm font-medium text-white ${active ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
            >
              {active ? t.memberView.deactivate : t.memberView.reactivate}
            </button>
          </div>
        </div>

        {/* ============ CENTER: timeline / notes / tasks / files ============ */}
        <div className="rounded-lg border border-neutral-200 bg-white">
          <div className="flex border-b border-neutral-200">
            {(["timeline", "notes", "tasks", "files"] as Tab[]).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={`px-4 py-2.5 text-sm font-medium ${tab === tabKey ? "border-b-2 border-brand text-brand" : "text-neutral-500 hover:text-neutral-800"}`}
              >
                {t.memberView.tabs[tabKey]}
              </button>
            ))}
          </div>
          <div className="max-h-[560px] overflow-y-auto p-4">
            {tab === "timeline" && <TimelineTab memberId={id} />}
            {tab === "notes" && <NotesTab memberId={id} />}
            {tab === "tasks" && <TasksTab memberId={id} />}
            {tab === "files" && <FilesTab memberId={id} />}
          </div>
        </div>

        {/* ============ RIGHT: quick actions & stats ============ */}
        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold">{t.memberView.quickActions}</h2>
            <div className="space-y-2">
              <button
                onClick={async () => { await recordManualCheckIn(id); notify("success", t.memberView.checkInRecorded); load(); }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-left text-sm hover:bg-neutral-50"
              >
                {t.memberView.logAttendance}
              </button>
              <button
                onClick={() => router.push(`/payments?member=${id}`)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-left text-sm hover:bg-neutral-50"
              >
                {t.memberView.recordPayment}
              </button>
              <button
                onClick={async () => {
                  if (!member.email) { notify("info", t.memberView.noEmail); return; }
                  const r = await inviteMemberEmail(member.email);
                  notify(r.ok ? "success" : "error", r.ok ? t.memberView.inviteSent(member.email) : t.memberView.inviteFailed(r.error ?? ""));
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-left text-sm hover:bg-neutral-50"
              >
                {t.memberView.sendInvite}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4 text-center">
            <h2 className="mb-2 text-sm font-semibold">{t.memberView.checkInQr}</h2>
            <div className={current ? "" : "opacity-20"}>
              <QRCodeSVG value={`oxround:checkin:${member.id}`} size={120} className="mx-auto" />
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {current ? t.memberView.qrFallback : t.memberView.qrGated}
            </p>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold">{t.memberView.attendance}</h2>
            <p className="text-2xl font-bold">{last30}<span className="ml-1 text-sm font-normal text-neutral-500">{t.memberView.visits30}</span></p>
            <p className="text-xs text-neutral-500">{t.memberView.attendanceTotal(checkIns.length, checkIns[0] ? fmt.date(checkIns[0].checked_in_at) : "—")}</p>
          </div>
        </div>
      </div>

      {editing && (
        <EditProfileModal
          member={member}
          membership={membership}
          plans={plans}
          busy={profileSaving}
          onCancel={() => setEditing(false)}
          onSave={saveProfile}
        />
      )}
    </div>
  );
}

function ageFromDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const dob = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hadBirthday = today.getMonth() > dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hadBirthday) age--;
  return age >= 0 ? age : null;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-neutral-500">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function EditProfileModal({ member, membership, plans, busy, onSave, onCancel }: {
  member: GymMember;
  membership: Membership | null;
  plans: MembershipPlan[];
  busy: boolean;
  onSave: (fields: MemberProfileUpdate, planId?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState({
    first_name: member.first_name,
    last_name: member.last_name ?? "",
    email: member.email ?? "",
    phone: member.phone ?? "",
    date_of_birth: member.date_of_birth ?? "",
    weight_class: member.weight_class ?? "",
    joined_at: member.joined_at ?? "",
  });
  const [planId, setPlanId] = useState(membership?.id ? (plans.find((plan) => plan.name === membership.plan_name)?.id ?? "") : "");
  const labels = {
    first_name: t.members.labelFirstName,
    last_name: t.members.labelLastName,
    email: t.members.labelEmail,
    phone: t.members.labelPhone,
    date_of_birth: t.members.labelDateOfBirth,
    weight_class: t.members.labelWeightClass,
    joined_at: t.members.labelDateJoined,
  };
  const fields = ["first_name", "last_name", "email", "phone", "date_of_birth", "weight_class", "joined_at"] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel} role="dialog" aria-modal="true">
      <form
        onSubmit={(e) => { e.preventDefault(); onSave(form, membership ? planId : undefined); }}
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold">{t.memberView.editProfile}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field} className={field === "email" || field === "phone" ? "sm:col-span-2" : ""}>
              <span className="mb-1 block text-xs font-medium uppercase text-neutral-500">{labels[field]}</span>
              <input
                type={field === "email" ? "email" : field === "date_of_birth" || field === "joined_at" ? "date" : "text"}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
          ))}
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase text-neutral-500">{t.memberView.plan}</span>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              disabled={!membership}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              <option value="">{t.memberView.none}</option>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
          </label>
        </div>
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

// ---- Center tabs ----

const EVENT_ICON: Record<string, string> = {
  check_in: "🥊", payment: "💵", membership_change: "🔄", member_created: "⭐",
  status_change: "⚙️", note_added: "📝", task_done: "✅", message: "💬", custom: "•",
};

function TimelineTab({ memberId }: { memberId: string }) {
  const t = useT();
  const fmt = useFormat();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    memberTimeline(memberId, page).then((e) => {
      setEvents((prev) => (page === 0 ? e : [...prev, ...e]));
      if (e.length < 50) setDone(true);
    }).catch(() => setDone(true));
  }, [memberId, page]);

  if (events.length === 0) return <p className="text-sm text-neutral-500">{t.memberView.emptyTimeline}</p>;
  return (
    <div>
      <ol className="relative ml-2 border-l border-neutral-200">
        {events.map((e) => (
          <li key={e.id} className="mb-4 ml-4">
            <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px]">{EVENT_ICON[e.event_type] ?? "•"}</span>
            <div className="text-sm font-medium">{e.title ?? t.labels.timelineEvent[e.event_type] ?? e.event_type.replace("_", " ")}
              {e.event_type === "payment" && e.properties?.amount_cents != null && (
                <span className="ml-1 text-neutral-500">· {fmt.money(Number(e.properties.amount_cents) / 100)}</span>
              )}
            </div>
            <div className="text-xs text-neutral-400">
              {fmt.dateTime(e.happens_at, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </div>
          </li>
        ))}
      </ol>
      {!done && (
        <button onClick={() => setPage(page + 1)} className="mt-2 text-xs font-medium text-brand hover:underline">{t.memberView.loadOlder}</button>
      )}
    </div>
  );
}

function NotesTab({ memberId }: { memberId: string }) {
  const t = useT();
  const fmt = useFormat();
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<CoachNote["visibility"]>("staff");
  const load = () => { listMemberNotes(memberId).then(setNotes).catch(() => setNotes([])); };
  useEffect(load, [memberId]);
  const { submitting, run } = useSubmit(async () => {
    await addMemberNote(memberId, body, visibility);
    setBody("");
    load();
  }, { successMessage: t.memberView.noteSaved });

  return (
    <div>
      <div className="mb-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t.memberView.notePlaceholder}
          className="h-20 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex items-center justify-between">
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as CoachNote["visibility"])} className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
            <option value="staff">{t.labels.noteVisibility.staff}</option>
            <option value="owner_only">{t.labels.noteVisibility.owner_only}</option>
            <option value="member_visible">{t.labels.noteVisibility.member_visible}</option>
          </select>
          <button disabled={submitting || !body.trim()} onClick={() => run()} className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">
            {submitting ? t.common.saving : t.memberView.addNote}
          </button>
        </div>
      </div>
      {notes.length === 0 ? <p className="text-sm text-neutral-500">{t.memberView.noNotes}</p> : notes.map((n) => (
        <div key={n.id} className="mb-3 rounded-md border border-neutral-100 bg-neutral-50 p-3">
          <p className="text-sm">{n.body}</p>
          <p className="mt-1 text-xs text-neutral-400">
            {n.author_name || t.memberView.staffFallback} · {fmt.date(n.created_at)} · {t.labels.noteVisibility[n.visibility]}
          </p>
        </div>
      ))}
    </div>
  );
}

function TasksTab({ memberId }: { memberId: string }) {
  const t = useT();
  const fmt = useFormat();
  const [tasks, setTasks] = useState<GymTask[]>([]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const load = () => { listTasks({ memberId }).then(setTasks).catch(() => setTasks([])); };
  useEffect(load, [memberId]);
  const { submitting, run } = useSubmit(async () => {
    await createTask({ title, due_at: due ? new Date(due).toISOString() : null, target_member_id: memberId });
    setTitle(""); setDue("");
    load();
  }, { successMessage: t.memberView.taskAdded });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.memberView.taskPlaceholder} className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-2 text-sm" />
        <button disabled={submitting || !title.trim()} onClick={() => run()} className="rounded-md bg-brand px-3 py-2 text-xs font-medium text-white disabled:opacity-40">{t.memberView.addTask}</button>
      </div>
      {tasks.length === 0 ? <p className="text-sm text-neutral-500">{t.memberView.noTasks}</p> : tasks.map((task) => (
        <label key={task.id} className="mb-2 flex items-start gap-2 rounded-md border border-neutral-100 p-2.5">
          <input
            type="checkbox"
            checked={task.status === "done"}
            onChange={async (e) => { await setTaskStatus(task.id, e.target.checked ? "done" : "todo"); load(); }}
            className="mt-0.5"
          />
          <span className={`text-sm ${task.status === "done" ? "text-neutral-400 line-through" : ""}`}>
            {task.title}
            {task.due_at && <span className="ml-2 text-xs text-neutral-400">{t.memberView.due(fmt.date(task.due_at))}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

function FilesTab({ memberId }: { memberId: string }) {
  const t = useT();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [category, setCategory] = useState<Attachment["category"]>("waiver");
  const inputRef = useRef<HTMLInputElement>(null);
  const load = () => { listAttachments(memberId).then(setFiles).catch(() => setFiles([])); };
  useEffect(load, [memberId]);
  const { submitting, run } = useSubmit(async (file: File) => {
    await uploadAttachment(memberId, file, category);
    load();
  }, { successMessage: t.memberView.fileUploaded });

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value as Attachment["category"])} className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs">
          <option value="waiver">{t.labels.attachmentCategory.waiver}</option>
          <option value="document">{t.labels.attachmentCategory.document}</option>
          <option value="image">{t.labels.attachmentCategory.image}</option>
          <option value="other">{t.labels.attachmentCategory.other}</option>
        </select>
        <input ref={inputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ""; }} />
        <button disabled={submitting} onClick={() => inputRef.current?.click()} className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-40">
          {submitting ? t.memberView.uploading : t.memberView.uploadFile}
        </button>
      </div>
      {files.length === 0 ? <p className="text-sm text-neutral-500">{t.memberView.noFiles}</p> : files.map((f) => (
        <div key={f.id} className="mb-2 flex items-center justify-between rounded-md border border-neutral-100 p-2.5 text-sm">
          <span>
            {f.category === "waiver" ? "📄 " : "📎 "}{f.name}
            <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">{t.labels.attachmentCategory[f.category]}</span>
          </span>
          <button
            onClick={async () => {
              const url = await attachmentUrl(f);
              if (url) window.open(url, "_blank");
              else notify("info", t.memberView.previewUnavailable);
            }}
            className="text-xs font-medium text-brand hover:underline"
          >
            {t.memberView.viewFile}
          </button>
        </div>
      ))}
    </div>
  );
}
