"use client";
// Session roster: bookings, waitlist, attended/no-show marking, add member, cancel session.
// Query-param routing (/classes/session?id=) for static-export compat.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addBooking, cancelSession, getSession, listMembers, sessionBookings, setBookingStatus } from "@/lib/data";
import type { ClassBooking, ClassSession, GymMember } from "@/lib/types";

function SessionInner() {
  const id = useSearchParams().get("id") ?? "";
  const [session, setSession] = useState<ClassSession | null>(null);
  const [bookings, setBookings] = useState<ClassBooking[]>([]);
  const [members, setMembers] = useState<GymMember[]>([]);
  const [addId, setAddId] = useState("");

  const load = async () => {
    const [s, b, m] = await Promise.all([getSession(id), sessionBookings(id), listMembers()]);
    setSession(s);
    setBookings(b);
    setMembers(m);
  };
  useEffect(() => { if (id) load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return <div className="text-neutral-500">Loading session…</div>;

  const active = bookings.filter((b) => b.status === "booked" || b.status === "attended" || b.status === "no_show");
  const waitlist = bookings.filter((b) => b.status === "waitlisted");
  const bookedIds = new Set(bookings.map((b) => b.gym_member_id));
  const addable = members.filter((m) => !bookedIds.has(m.id) && m.roles.includes("member"));

  const mark = async (bookingId: string, status: ClassBooking["status"]) => {
    await setBookingStatus(bookingId, status);
    load();
  };

  return (
    <div>
      <Link href="/classes" className="text-sm text-brand hover:underline">← Back to classes</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{session.class_name}{session.status === "canceled" && <span className="ml-3 rounded bg-neutral-200 px-2 py-1 text-sm font-medium text-neutral-600">CANCELED</span>}</h1>
          <p className="text-sm text-neutral-500">{session.session_date} · {session.start_time.slice(0, 5)} · {session.duration_mins} min · Coach: {session.coach_name}
            {session.capacity != null && <> · {active.filter((b) => b.status !== "no_show").length}/{session.capacity} spots</>}</p>
        </div>
        {session.status === "scheduled" && (
          <button onClick={async () => { if (confirm("Cancel this session? Booked members should be notified.")) { await cancelSession(id); load(); } }}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Cancel session</button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={addId} onChange={(e) => setAddId(e.target.value)} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
          <option value="">Add a member…</option>
          {addable.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
        </select>
        <button disabled={!addId} onClick={async () => { await addBooking(id, addId); setAddId(""); load(); }}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Book</button>
        <span className="text-xs text-neutral-400">Full sessions auto-waitlist.</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr><th className="px-4 py-2">Member</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Booked</th><th className="px-4 py-2 text-right">Mark</th></tr>
          </thead>
          <tbody>
            {active.map((b) => (
              <tr key={b.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-medium">{b.member_name}</td>
                <td className="px-4 py-2"><StatusBadge status={b.status} /></td>
                <td className="px-4 py-2 text-neutral-500">{b.booked_at.slice(0, 10)}</td>
                <td className="px-4 py-2 text-right">
                  {b.status === "booked" && <>
                    <button onClick={() => mark(b.id, "attended")} className="mr-3 text-xs text-green-700 hover:underline">attended</button>
                    <button onClick={() => mark(b.id, "no_show")} className="mr-3 text-xs text-red-600 hover:underline">no-show</button>
                    <button onClick={() => mark(b.id, "canceled")} className="text-xs text-neutral-500 hover:underline">cancel</button>
                  </>}
                </td>
              </tr>
            ))}
            {active.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-neutral-400">No bookings yet</td></tr>}
          </tbody>
        </table>
      </div>

      {waitlist.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-lg font-semibold">Waitlist ({waitlist.length})</h2>
          <div className="overflow-hidden rounded-lg border border-yellow-200 bg-yellow-50">
            <table className="w-full text-sm">
              <tbody>
                {waitlist.map((b, i) => (
                  <tr key={b.id} className="border-t border-yellow-100 first:border-t-0">
                    <td className="px-4 py-2 text-xs text-neutral-500">#{i + 1}</td>
                    <td className="px-4 py-2 font-medium">{b.member_name}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => mark(b.id, "booked")} className="mr-3 text-xs text-green-700 hover:underline">promote</button>
                      <button onClick={() => mark(b.id, "canceled")} className="text-xs text-neutral-500 hover:underline">remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    booked: "bg-blue-100 text-blue-700",
    attended: "bg-green-100 text-green-700",
    no_show: "bg-red-100 text-red-700",
    waitlisted: "bg-yellow-100 text-yellow-700",
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-neutral-100 text-neutral-600"}`}>{status.replace("_", "-")}</span>;
}

export default function SessionPage() {
  return <Suspense fallback={<div className="text-neutral-500">Loading…</div>}><SessionInner /></Suspense>;
}
