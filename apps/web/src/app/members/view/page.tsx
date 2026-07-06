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
  listAttachments, listMemberNotes, listTasks, memberCheckIns, memberTimeline,
  recordManualCheckIn, setMemberStatus, setPaymentStatus, setTaskStatus, uploadAttachment,
} from "@/lib/data";
import { useSubmit } from "@/lib/useSubmit";
import { notify } from "@/components/toast";
import type {
  Attachment, CheckIn, CoachNote, GymMember, GymTask, Membership, PaymentStatus, TimelineEvent,
} from "@/lib/types";

const PAYMENT_OPTIONS: PaymentStatus[] = ["paid", "pending", "overdue", "comped"];
type Tab = "timeline" | "notes" | "tasks" | "files";

export default function MemberViewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
      <FighterCard />
    </Suspense>
  );
}

function FighterCard() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const [member, setMember] = useState<GymMember | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [tab, setTab] = useState<Tab>("timeline");

  const load = async () => {
    setMember(await getMember(id));
    setMembership(await getMembership(id));
    setCheckIns(await memberCheckIns(id));
  };
  useEffect(() => { if (id) load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!member) return <p className="text-sm text-neutral-500">Loading…</p>;

  const active = member.status === "active";
  const paymentOk = !membership || membership.payment_status === "paid" || membership.payment_status === "comped";
  const current = active && paymentOk;
  const last30 = checkIns.filter((c) => Date.now() - new Date(c.checked_in_at).getTime() <= 30 * 86400000).length;
  const fr = member.fight_record;

  return (
    <div>
      <button onClick={() => router.back()} className="mb-4 text-sm text-neutral-500 hover:underline">← Back</button>

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
                <p className="text-xs text-neutral-500">joined {member.joined_at ?? "—"}</p>
              </div>
            </div>
            <div className={`mb-3 rounded-md px-3 py-2 text-center text-sm font-bold tracking-wide ${
              current ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {current ? "MEMBERSHIP CURRENT" : active ? "PAST DUE / ACCESS GATED" : "INACTIVE / ACCESS DENIED"}
            </div>
            <dl className="space-y-1.5 text-sm">
              <Row k="Email" v={member.email ?? "—"} />
              <Row k="Phone" v={member.phone ?? "—"} />
              <Row k="Plan" v={membership?.plan_name ?? "none"} />
              <Row k="Next billing" v={membership?.next_billing_date ?? "—"} />
              <Row k="Weight class" v={member.weight_class ?? "—"} />
              <Row k="Skill level" v={member.skill_level ?? "—"} />
              <Row k="Record" v={fr ? `${fr.wins}-${fr.losses}-${fr.draws}` : "—"} />
            </dl>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <label className="mb-1 block text-xs font-medium uppercase text-neutral-500">Payment status</label>
            <div className="mb-3 flex flex-wrap gap-2">
              {PAYMENT_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={async () => { await setPaymentStatus(id, p); load(); }}
                  className={`rounded-md border px-3 py-1 text-xs font-medium ${
                    membership?.payment_status === p ? "border-brand bg-red-50 text-brand" : "border-neutral-300 text-neutral-600"}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={async () => { await setMemberStatus(id, active ? "inactive" : "active"); load(); }}
              className={`w-full rounded-md px-4 py-2 text-sm font-medium text-white ${active ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
            >
              {active ? "Deactivate membership (QR stops working)" : "Reactivate membership"}
            </button>
          </div>
        </div>

        {/* ============ CENTER: timeline / notes / tasks / files ============ */}
        <div className="rounded-lg border border-neutral-200 bg-white">
          <div className="flex border-b border-neutral-200">
            {(["timeline", "notes", "tasks", "files"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-brand text-brand" : "text-neutral-500 hover:text-neutral-800"}`}
              >
                {t}
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
            <h2 className="mb-2 text-sm font-semibold">Quick actions</h2>
            <div className="space-y-2">
              <button
                onClick={async () => { await recordManualCheckIn(id); notify("success", "Check-in recorded."); load(); }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-left text-sm hover:bg-neutral-50"
              >
                ✓ Log attendance now
              </button>
              <button
                onClick={() => router.push(`/payments?member=${id}`)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-left text-sm hover:bg-neutral-50"
              >
                $ Record a payment
              </button>
              <button
                onClick={async () => {
                  if (!member.email) { notify("info", "No email on file — add one via Edit on the Members page."); return; }
                  const r = await inviteMemberEmail(member.email);
                  notify(r.ok ? "success" : "error", r.ok ? `Invite sent to ${member.email}.` : `Invite failed: ${r.error}`);
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-left text-sm hover:bg-neutral-50"
              >
                ✉ Send app invite
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4 text-center">
            <h2 className="mb-2 text-sm font-semibold">Check-in QR</h2>
            <div className={current ? "" : "opacity-20"}>
              <QRCodeSVG value={`oxround:checkin:${member.id}`} size={120} className="mx-auto" />
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {current ? "Print for QR-card fallback" : "Invalid while membership is gated"}
            </p>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold">Attendance</h2>
            <p className="text-2xl font-bold">{last30}<span className="ml-1 text-sm font-normal text-neutral-500">visits / 30 days</span></p>
            <p className="text-xs text-neutral-500">{checkIns.length} total · last: {checkIns[0] ? new Date(checkIns[0].checked_in_at).toLocaleDateString("en-CA") : "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-neutral-500">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

// ---- Center tabs ----

const EVENT_ICON: Record<string, string> = {
  check_in: "🥊", payment: "💵", membership_change: "🔄", member_created: "⭐",
  status_change: "⚙️", note_added: "📝", task_done: "✅", message: "💬", custom: "•",
};

function TimelineTab({ memberId }: { memberId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    memberTimeline(memberId, page).then((e) => {
      setEvents((prev) => (page === 0 ? e : [...prev, ...e]));
      if (e.length < 50) setDone(true);
    }).catch(() => setDone(true));
  }, [memberId, page]);

  if (events.length === 0) return <p className="text-sm text-neutral-500">Nothing here yet — check-ins, payments and changes will appear automatically.</p>;
  return (
    <div>
      <ol className="relative ml-2 border-l border-neutral-200">
        {events.map((e) => (
          <li key={e.id} className="mb-4 ml-4">
            <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px]">{EVENT_ICON[e.event_type] ?? "•"}</span>
            <div className="text-sm font-medium">{e.title ?? e.event_type.replace("_", " ")}
              {e.event_type === "payment" && e.properties?.amount_cents != null && (
                <span className="ml-1 text-neutral-500">· ${(Number(e.properties.amount_cents) / 100).toFixed(2)}</span>
              )}
            </div>
            <div className="text-xs text-neutral-400">
              {new Date(e.happens_at).toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </div>
          </li>
        ))}
      </ol>
      {!done && (
        <button onClick={() => setPage(page + 1)} className="mt-2 text-xs font-medium text-brand hover:underline">Load older…</button>
      )}
    </div>
  );
}

function NotesTab({ memberId }: { memberId: string }) {
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<CoachNote["visibility"]>("staff");
  const load = () => { listMemberNotes(memberId).then(setNotes).catch(() => setNotes([])); };
  useEffect(load, [memberId]);
  const { submitting, run } = useSubmit(async () => {
    await addMemberNote(memberId, body, visibility);
    setBody("");
    load();
  }, { successMessage: "Note saved." });

  return (
    <div>
      <div className="mb-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Coaching note — e.g. “Left hook drops when throwing combinations”"
          className="h-20 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex items-center justify-between">
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as CoachNote["visibility"])} className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
            <option value="staff">Visible to staff</option>
            <option value="owner_only">Owner only</option>
            <option value="member_visible">Also visible to the member</option>
          </select>
          <button disabled={submitting || !body.trim()} onClick={() => run()} className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">
            {submitting ? "Saving…" : "Add note"}
          </button>
        </div>
      </div>
      {notes.length === 0 ? <p className="text-sm text-neutral-500">No notes yet.</p> : notes.map((n) => (
        <div key={n.id} className="mb-3 rounded-md border border-neutral-100 bg-neutral-50 p-3">
          <p className="text-sm">{n.body}</p>
          <p className="mt-1 text-xs text-neutral-400">
            {n.author_name || "Staff"} · {new Date(n.created_at).toLocaleDateString("en-CA")} · {n.visibility.replace("_", " ")}
          </p>
        </div>
      ))}
    </div>
  );
}

function TasksTab({ memberId }: { memberId: string }) {
  const [tasks, setTasks] = useState<GymTask[]>([]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const load = () => { listTasks({ memberId }).then(setTasks).catch(() => setTasks([])); };
  useEffect(load, [memberId]);
  const { submitting, run } = useSubmit(async () => {
    await createTask({ title, due_at: due ? new Date(due).toISOString() : null, target_member_id: memberId });
    setTitle(""); setDue("");
    load();
  }, { successMessage: "Task added." });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Follow up about renewal…" className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-2 text-sm" />
        <button disabled={submitting || !title.trim()} onClick={() => run()} className="rounded-md bg-brand px-3 py-2 text-xs font-medium text-white disabled:opacity-40">Add</button>
      </div>
      {tasks.length === 0 ? <p className="text-sm text-neutral-500">No tasks for this member.</p> : tasks.map((t) => (
        <label key={t.id} className="mb-2 flex items-start gap-2 rounded-md border border-neutral-100 p-2.5">
          <input
            type="checkbox"
            checked={t.status === "done"}
            onChange={async (e) => { await setTaskStatus(t.id, e.target.checked ? "done" : "todo"); load(); }}
            className="mt-0.5"
          />
          <span className={`text-sm ${t.status === "done" ? "text-neutral-400 line-through" : ""}`}>
            {t.title}
            {t.due_at && <span className="ml-2 text-xs text-neutral-400">due {new Date(t.due_at).toLocaleDateString("en-CA")}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

function FilesTab({ memberId }: { memberId: string }) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [category, setCategory] = useState<Attachment["category"]>("waiver");
  const inputRef = useRef<HTMLInputElement>(null);
  const load = () => { listAttachments(memberId).then(setFiles).catch(() => setFiles([])); };
  useEffect(load, [memberId]);
  const { submitting, run } = useSubmit(async (file: File) => {
    await uploadAttachment(memberId, file, category);
    load();
  }, { successMessage: "File uploaded." });

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value as Attachment["category"])} className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs">
          <option value="waiver">Signed waiver</option>
          <option value="document">Document</option>
          <option value="image">Image</option>
          <option value="other">Other</option>
        </select>
        <input ref={inputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ""; }} />
        <button disabled={submitting} onClick={() => inputRef.current?.click()} className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-40">
          {submitting ? "Uploading…" : "+ Upload file"}
        </button>
      </div>
      {files.length === 0 ? <p className="text-sm text-neutral-500">No files — upload the signed liability waiver here.</p> : files.map((f) => (
        <div key={f.id} className="mb-2 flex items-center justify-between rounded-md border border-neutral-100 p-2.5 text-sm">
          <span>
            {f.category === "waiver" ? "📄 " : "📎 "}{f.name}
            <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">{f.category}</span>
          </span>
          <button
            onClick={async () => {
              const url = await attachmentUrl(f);
              if (url) window.open(url, "_blank");
              else notify("info", "Preview isn't available in demo mode.");
            }}
            className="text-xs font-medium text-brand hover:underline"
          >
            View
          </button>
        </div>
      ))}
    </div>
  );
}
