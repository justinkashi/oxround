"use client";
// C2 Member management: list, search, filter, create. (Demo slice feature 1 / A3)

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createMember, createMembersBulk, inviteMemberEmail, listArchivedMembers,
  listMembersWithMemberships, setMemberStatus, updateMember, MEMBERS_PAGE_SIZE,
  type BulkMemberInput, type MemberFilter, type MemberWithMembership,
} from "@/lib/data";
import type { GymMember } from "@/lib/types";
import DestructiveActionModal from "@/components/DestructiveActionModal";

function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return "Something went wrong — please try again.";
}

export default function MembersPage() {
  const [rows, setRows] = useState<MemberWithMembership[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [archived, setArchived] = useState<GymMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<GymMember | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", role: "member" as "member" | "coach" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ms, arch] = await Promise.all([
        listMembersWithMemberships({ page, q, filter }),
        listArchivedMembers(),
      ]);
      setRows(ms.rows);
      setTotal(ms.total);
      setArchived(arch);
    } catch (e) {
      setLoadError(errText(e));
    } finally {
      setLoading(false);
    }
  };
  // Debounced server-side search + filter + page (VERSION 2: max 50 rows per fetch).
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [page, q, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = rows;
  const pageCount = Math.max(1, Math.ceil(total / MEMBERS_PAGE_SIZE));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await createMember(form);
      // D-24: email the new person an activation link (member → app, coach → CRM). No-op in demo.
      if (form.email) {
        const r = await inviteMemberEmail(form.email);
        setNotice(r.ok
          ? `${form.first_name} added ✓ — app invite sent to ${form.email}.`
          : `${form.first_name} added ✓. Invite not sent yet (${r.error}) — use “Resend invite” on their row anytime; it doesn't affect their membership.`);
      } else {
        setNotice(`${form.first_name} added ✓. No email on file, so no app invite yet — add one via Edit to invite them.`);
      }
      setForm({ first_name: "", last_name: "", email: "", phone: "", role: "member" });
      setShowForm(false);
      load();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (fields: { first_name: string; last_name: string; email: string; phone: string }) => {
    if (!editing) return;
    setEditBusy(true);
    setEditError(null);
    try {
      await updateMember(editing.id, fields);
      setNotice(`${fields.first_name} updated ✓.`);
      setEditing(null);
      load();
    } catch (err) {
      setEditError(errText(err));
    } finally {
      setEditBusy(false);
    }
  };

  // Archive flows through DestructiveActionModal (type-to-confirm) — VERSION 2.
  const [archiving, setArchiving] = useState<GymMember | null>(null);
  const archive = async (m: GymMember) => {
    setError(null);
    await setMemberStatus(m.id, "archived"); // throws → modal surfaces the toast
    setNotice(`${m.first_name} archived.`);
    load();
  };

  const restore = async (m: GymMember) => {
    setError(null);
    try {
      await setMemberStatus(m.id, "active");
      setNotice(`${m.first_name} restored to your active list.`);
      load();
    } catch (err) {
      setError(errText(err));
    }
  };

  const resend = async (m: GymMember) => {
    if (!m.email) { setNotice(`${m.first_name} has no email — add one via Edit first.`); return; }
    setNotice(`Sending invite to ${m.email}…`);
    const r = await inviteMemberEmail(m.email);
    setNotice(r.ok ? `Invite sent to ${m.email} ✓.` : `Couldn't send invite to ${m.email}: ${r.error}`);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Members</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowImport(!showImport); setShowForm(false); }} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            Import CSV
          </button>
          <button onClick={() => { setShowForm(!showForm); setShowImport(false); }} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            + Add member
          </button>
        </div>
      </div>

      {notice && <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">{notice}</div>}
      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {showImport && (
        <ImportCsv
          existingEmails={new Set(rows.map(({ member: m }) => (m.email ?? "").toLowerCase()).filter(Boolean))}
          onDone={(msg) => { setNotice(msg); setShowImport(false); load(); }}
        />
      )}

      {showForm && (
        <form onSubmit={submit} className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-6">
          {(["first_name", "last_name", "email", "phone"] as const).map((f) => (
            <input
              key={f}
              required={f === "first_name"}
              type={f === "email" ? "email" : "text"}
              placeholder={f === "phone" ? "phone (optional)" : f === "email" ? "email (optional)" : f.replace("_", " ")}
              value={form[f]}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          ))}
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "member" | "coach" })} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
            <option value="member">Member</option>
            <option value="coach">Coach</option>
          </select>
          <button type="submit" disabled={busy} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Adding…" : "Create"}</button>
          <p className="text-xs text-neutral-400 sm:col-span-2 md:col-span-6">Member → gets the member app. Coach → gets the CRM (restricted). An invite email is sent if you provide one.</p>
        </form>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          placeholder="Search members…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-1.5">
          {([["all", "All"], ["past_due", "Past due"], ["new_this_month", "New this month"]] as [MemberFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setFilter(key); setPage(0); }}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === key ? "border-brand bg-brand text-white" : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowArchived(!showArchived)} className="whitespace-nowrap text-sm text-neutral-500 hover:text-brand">
          {showArchived ? "Hide archived" : `Show archived${archived.length ? ` (${archived.length})` : ""}`}
        </button>
      </div>

      {loading ? (
        <p className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Loading members…</p>
      ) : loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load members: {loadError}
          <button onClick={load} className="ml-2 font-medium underline">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
          {q ? "No members match your search." : "No members yet — add your first one, or import a CSV."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Payment</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Joined</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ member: m, membership: s }) => (
                <tr key={m.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <Link href={`/members/view?id=${m.id}`} className="font-medium text-brand hover:underline">
                      {m.first_name} {m.last_name}
                    </Link>
                    {m.roles.includes("coach") && <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">coach</span>}
                  </td>
                  <td className="px-4 py-2">{s?.plan_name ?? "—"}</td>
                  <td className="px-4 py-2"><PaymentBadge status={s?.payment_status} /></td>
                  <td className="px-4 py-2">{m.status}</td>
                  <td className="px-4 py-2 text-neutral-500">{m.joined_at ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <button onClick={() => { setEditing(m); setEditError(null); }} className="text-xs font-medium text-neutral-600 hover:text-brand">Edit</button>
                    <button onClick={() => resend(m)} className="ml-3 text-xs font-medium text-neutral-600 hover:text-brand">Resend invite</button>
                    <button onClick={() => setArchiving(m)} className="ml-3 text-xs font-medium text-red-600 hover:underline">Archive</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-2 text-xs text-neutral-500">
              <span>{total} members · page {page + 1} of {pageCount}</span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border border-neutral-300 px-2 py-1 disabled:opacity-40">← Prev</button>
                <button disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)} className="rounded border border-neutral-300 px-2 py-1 disabled:opacity-40">Next →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showArchived && (
        <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-neutral-600">Archived ({archived.length})</h2>
          {archived.length === 0 ? (
            <p className="text-xs text-neutral-400">No archived members.</p>
          ) : archived.map((m) => (
            <div key={m.id} className="flex items-center justify-between border-b border-neutral-200 py-1.5 text-sm last:border-0">
              <span>{m.first_name} {m.last_name} {m.email && <span className="text-neutral-400">· {m.email}</span>}</span>
              <button onClick={() => restore(m)} className="text-xs font-medium text-green-700 hover:underline">Restore</button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditMemberModal
          member={editing}
          busy={editBusy}
          error={editError}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      <DestructiveActionModal
        open={!!archiving}
        title={`Archive ${archiving?.first_name ?? ""} ${archiving?.last_name ?? ""}?`}
        description="They leave your active list but are NOT deleted — restore them anytime from “Show archived”. Their history (check-ins, payments) is kept."
        actionLabel="Archive member"
        confirmText={archiving ? `${archiving.first_name} ${archiving.last_name ?? ""}`.trim() : undefined}
        onConfirm={async () => { if (archiving) await archive(archiving); }}
        onClose={() => setArchiving(null)}
      />
    </div>
  );
}

function EditMemberModal({ member, busy, error, onSave, onCancel }: {
  member: GymMember;
  busy: boolean;
  error: string | null;
  onSave: (f: { first_name: string; last_name: string; email: string; phone: string }) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    first_name: member.first_name,
    last_name: member.last_name ?? "",
    email: member.email ?? "",
    phone: member.phone ?? "",
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">Edit member</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["first_name", "last_name", "email", "phone"] as const).map((k) => (
            <div key={k} className={k === "email" || k === "phone" ? "sm:col-span-2" : ""}>
              <label className="mb-1 block text-xs font-medium uppercase text-neutral-500">
                {k.replace("_", " ")}{k === "phone" || k === "email" ? " (optional)" : ""}
              </label>
              <input
                type={k === "email" ? "email" : "text"}
                value={f[k]}
                onChange={(e) => setF({ ...f, [k]: e.target.value })}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        {error && <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Cancel</button>
          <button disabled={busy || !f.first_name.trim()} onClick={() => onSave(f)} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}

function PaymentBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-neutral-400">—</span>;
  const colors: Record<string, string> = {
    paid: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    overdue: "bg-red-100 text-red-700",
    comped: "bg-neutral-100 text-neutral-600",
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status]}`}>{status}</span>;
}

// ---- CSV import (bulk member migration) ----

// Minimal CSV parser: handles quoted fields, escaped quotes, and \r\n.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim().length));
}

// Map parsed rows to members. Recognizes header names (EN/FR) in any order;
// with no header, assumes first_name, last_name, email, phone. Splits a single "name" column.
function rowsToMembers(rows: string[][]): { members: BulkMemberInput[]; bodyCount: number } {
  if (!rows.length) return { members: [], bodyCount: 0 };
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const header = rows[0].map(norm);
  const looksHeader = header.some((h) =>
    h.includes("name") || h.includes("email") || h.includes("courriel") || h.includes("phone") ||
    h.includes("tel") || h === "nom" || h === "prenom" || h === "prénom");
  const col = { first: -1, last: -1, name: -1, email: -1, phone: -1 };
  if (looksHeader) header.forEach((h, i) => {
    if (col.email < 0 && (h.includes("email") || h.includes("courriel"))) col.email = i;
    else if (col.phone < 0 && (h.includes("phone") || h.includes("tel") || h.includes("mobile"))) col.phone = i;
    else if (col.first < 0 && (h.includes("first") || h === "prenom" || h === "prénom")) col.first = i;
    else if (col.last < 0 && (h.includes("last") || h === "nom" || h.includes("surname"))) col.last = i;
    else if (col.name < 0 && (h === "name" || h === "fullname")) col.name = i;
  });
  const body = looksHeader ? rows.slice(1) : rows;
  const members = body.map((r) => {
    if (!looksHeader) return { first_name: r[0] ?? "", last_name: r[1] ?? "", email: r[2] ?? "", phone: r[3] ?? "" };
    let first = col.first >= 0 ? (r[col.first] ?? "") : "";
    let last = col.last >= 0 ? (r[col.last] ?? "") : "";
    if (col.first < 0 && col.name >= 0) {
      const parts = (r[col.name] ?? "").trim().split(/\s+/);
      first = parts.shift() ?? "";
      last = parts.join(" ");
    }
    return {
      first_name: first, last_name: last,
      email: col.email >= 0 ? (r[col.email] ?? "") : "",
      phone: col.phone >= 0 ? (r[col.phone] ?? "") : "",
    };
  }).filter((m) => (m.first_name ?? "").trim().length);
  return { members, bodyCount: body.length };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function ImportCsv({ existingEmails, onDone }: { existingEmails: Set<string>; onDone: (msg: string) => void }) {
  const [rows, setRows] = useState<BulkMemberInput[]>([]);
  const [invalid, setInvalid] = useState<{ row: BulkMemberInput; issue: string }[]>([]);
  const [stats, setStats] = useState<{ dupes: number; skipped: number } | null>(null);
  const [invite, setInvite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Validate-then-import (Twenty spreadsheet-import pattern): every row is
  // checked BEFORE anything is written; problem rows are listed, never inserted.
  const ingest = (text: string) => {
    setErr(null);
    if (!text.trim()) { setRows([]); setInvalid([]); setStats(null); return; }
    const { members, bodyCount } = rowsToMembers(parseCSV(text));
    const seen = new Set<string>();
    let dupes = 0;
    const kept: BulkMemberInput[] = [];
    const bad: { row: BulkMemberInput; issue: string }[] = [];
    for (const m of members) {
      const key = (m.email ?? "").trim().toLowerCase();
      if (key && !EMAIL_RE.test(key)) { bad.push({ row: m, issue: `invalid email “${m.email}”` }); continue; }
      if (key && (existingEmails.has(key) || seen.has(key))) { dupes++; continue; }
      if ((m.phone ?? "").trim() && (m.phone ?? "").replace(/[\s().+-]/g, "").match(/[^0-9]/)) {
        bad.push({ row: m, issue: `phone “${m.phone}” contains letters` });
        continue;
      }
      if (key) seen.add(key);
      kept.push(m);
    }
    setRows(kept);
    setInvalid(bad);
    setStats({ dupes, skipped: bodyCount - members.length });
    if (!kept.length && !bad.length) setErr("No usable rows found. Expected columns: first name, last name, email, phone.");
  };

  const doImport = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await createMembersBulk(rows);
      let invited = 0;
      if (invite) for (const m of rows) if (m.email) { const r = await inviteMemberEmail(m.email); if (r.ok) invited++; }
      const bits = [`Imported ${res.created} member${res.created === 1 ? "" : "s"}`];
      if (invite) bits.push(`emailed ${invited} invite${invited === 1 ? "" : "s"}`);
      onDone(bits.join(", ") + "." + (res.errors.length ? ` (${res.errors.join("; ")})` : ""));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed.");
    } finally { setBusy(false); }
  };

  const template = "first_name,last_name,email,phone\nJane,Doe,jane@example.com,514-555-0100\nMarco,Rossi,marco@example.com,514-555-0142\n";
  const templateHref = "data:text/csv;charset=utf-8," + encodeURIComponent(template);

  return (
    <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Import members from a spreadsheet</h2>
        <a href={templateHref} download="oxround-members-template.csv" className="text-xs font-medium text-brand hover:underline">Download CSV template</a>
      </div>
      <p className="mb-3 text-xs text-neutral-500">
        In Excel or Google Sheets, save your list as CSV, then choose the file (or paste it) below. We read columns named
        first name, last name, email and phone — in any order. No header row? We assume that order. Duplicate emails are skipped.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then(ingest); }}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white" />
        <span className="text-xs text-neutral-400">or paste below</span>
      </div>
      <textarea
        placeholder={"first_name,last_name,email,phone\nJane,Doe,jane@example.com,514-555-0100"}
        onChange={(e) => ingest(e.target.value)}
        className="mt-3 h-24 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs"
      />
      {err && <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {invalid.length > 0 && (
        <div className="mt-3 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-800">
          <p className="mb-1 font-semibold">{invalid.length} row{invalid.length === 1 ? "" : "s"} need fixing (won&apos;t be imported):</p>
          {invalid.slice(0, 5).map((b, i) => (
            <p key={i}>· {b.row.first_name} {b.row.last_name} — {b.issue}</p>
          ))}
          {invalid.length > 5 && <p>…and {invalid.length - 5} more. Fix them in your spreadsheet and re-upload.</p>}
        </div>
      )}
      {rows.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 text-sm text-neutral-700">
            <span className="font-semibold text-green-700">{rows.length} ready</span>
            {stats && stats.dupes > 0 && <span className="text-neutral-500"> · {stats.dupes} duplicate{stats.dupes === 1 ? "" : "s"} skipped</span>}
            {stats && stats.skipped > 0 && <span className="text-neutral-500"> · {stats.skipped} row{stats.skipped === 1 ? "" : "s"} without a name skipped</span>}
          </div>
          <div className="max-h-48 overflow-auto rounded-md border border-neutral-200">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr><th className="px-3 py-1.5">First</th><th className="px-3 py-1.5">Last</th><th className="px-3 py-1.5">Email</th><th className="px-3 py-1.5">Phone</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((m, i) => (
                  <tr key={i} className="border-t border-neutral-100">
                    <td className="px-3 py-1.5">{m.first_name}</td><td className="px-3 py-1.5">{m.last_name}</td>
                    <td className="px-3 py-1.5">{m.email}</td><td className="px-3 py-1.5">{m.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 8 && <div className="px-3 py-1.5 text-xs text-neutral-400">+{rows.length - 8} more…</div>}
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-neutral-600">
            <input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} />
            Also email each of them an app invite now (leave off to import quietly and invite later)
          </label>
          <button onClick={doImport} disabled={busy} className="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
            {busy ? "Importing…" : `Import ${rows.length} member${rows.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}
