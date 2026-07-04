"use client";
// Member profile (?id=...) — query-param route so the app static-exports for the
// public Cloudflare Pages demo. Same features: membership + payment toggle +
// deactivate (A3), QR (A1), attendance history + manual check-in (A2, D-10c).

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  getMember, getMembership, memberCheckIns, recordManualCheckIn,
  setMemberStatus, setPaymentStatus,
} from "@/lib/data";
import type { CheckIn, GymMember, Membership, PaymentStatus } from "@/lib/types";

const PAYMENT_OPTIONS: PaymentStatus[] = ["paid", "pending", "overdue", "comped"];

export default function MemberViewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
      <MemberProfile />
    </Suspense>
  );
}

function MemberProfile() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const [member, setMember] = useState<GymMember | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);

  const load = async () => {
    setMember(await getMember(id));
    setMembership(await getMembership(id));
    setCheckIns(await memberCheckIns(id));
  };
  useEffect(() => { if (id) load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!member) return <p className="text-sm text-neutral-500">Loading…</p>;

  const active = member.status === "active";
  const last30 = checkIns.filter((c) => Date.now() - new Date(c.checked_in_at).getTime() <= 30 * 86400000).length;

  return (
    <div className="max-w-3xl">
      <button onClick={() => router.back()} className="mb-4 text-sm text-neutral-500 hover:underline">← Back</button>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{member.first_name} {member.last_name}</h1>
          <p className="text-sm text-neutral-500">{member.email} · {member.phone} · joined {member.joined_at}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {member.status}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">Membership</h2>
          <p className="mb-1 text-sm">Plan: <strong>{membership?.plan_name ?? "none"}</strong></p>
          <p className="mb-3 text-sm">Next billing: {membership?.next_billing_date ?? "—"}</p>
          <label className="mb-1 block text-xs font-medium uppercase text-neutral-500">Payment status</label>
          <div className="mb-4 flex gap-2">
            {PAYMENT_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={async () => { await setPaymentStatus(id, p); load(); }}
                className={`rounded-md border px-3 py-1 text-xs font-medium ${
                  membership?.payment_status === p ? "border-brand bg-red-50 text-brand" : "border-neutral-300 text-neutral-600"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={async () => {
              await setMemberStatus(id, active ? "inactive" : "active");
              load();
            }}
            className={`w-full rounded-md px-4 py-2 text-sm font-medium text-white ${active ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
          >
            {active ? "Deactivate membership (QR stops working)" : "Reactivate membership"}
          </button>
          {!active && (
            <p className="mt-2 text-xs text-neutral-500">
              Deactivated — kiosk scans are rejected and the member sees inactive status in their app.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 text-center">
          <h2 className="mb-3 font-semibold">Check-in QR</h2>
          <div className={active ? "" : "opacity-20"}>
            <QRCodeSVG value={`oxround:checkin:${member.id}`} size={140} className="mx-auto" />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            {active ? "Print for QR card fallback (members without the app)" : "Invalid while membership is inactive"}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Attendance — {last30} visits in last 30 days · {checkIns.length} total</h2>
          <button
            onClick={async () => { await recordManualCheckIn(id); load(); }}
            className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-50"
          >
            + Manual check-in
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {checkIns.slice(0, 30).map((c) => (
            <div key={c.id} className="flex justify-between border-b border-neutral-100 py-1.5 text-sm last:border-0">
              <span>{new Date(c.checked_in_at).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}</span>
              <span className="text-neutral-500">
                {new Date(c.checked_in_at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })} · {c.method.replace("_", " ")}
              </span>
            </div>
          ))}
          {checkIns.length === 0 && <p className="text-sm text-neutral-500">No check-ins yet.</p>}
        </div>
      </div>
    </div>
  );
}
