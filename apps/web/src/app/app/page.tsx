"use client";
// Member-app preview: phone-framed walkthrough of the future Expo app (FEATURES: Member Mobile App).
// Viewed as Marco Silva. Splash = doors-opening animation (logs.md). This is a preview, not the real app.

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { bookingCounts, listAnnouncements, listSessions, memberCheckIns, addBooking, getMembership } from "@/lib/data";
import type { Announcement, CheckIn, ClassSession, Membership } from "@/lib/types";

const ME = { id: "m1", name: "Marco Silva", initials: "MS" };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function MemberAppPreview() {
  const [splash, setSplash] = useState(true);
  const [tab, setTab] = useState<"home" | "schedule" | "qr" | "profile">("home");
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [counts, setCounts] = useState<Record<string, { booked: number; waitlisted: number }>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [visits, setVisits] = useState<CheckIn[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [bookedMsg, setBookedMsg] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1800);
    return () => clearTimeout(t);
  }, []);

  const load = async () => {
    const today = new Date();
    const end = new Date();
    end.setDate(today.getDate() + 7);
    const [ses, ann, chk, mem] = await Promise.all([
      listSessions(iso(today), iso(end)),
      listAnnouncements(),
      memberCheckIns(ME.id),
      getMembership(ME.id),
    ]);
    const upcoming = ses.filter((s) => s.status === "scheduled");
    setSessions(upcoming);
    setCounts(await bookingCounts(upcoming.map((s) => s.id)));
    setAnnouncements(ann);
    setVisits(chk);
    setMembership(mem);
  };
  useEffect(() => { load(); }, []);

  const book = async (s: ClassSession) => {
    await addBooking(s.id, ME.id);
    setBookedMsg(`Booked: ${s.class_name} ${s.session_date} ${s.start_time.slice(0, 5)}`);
    setTimeout(() => setBookedMsg(""), 2500);
    load();
  };

  return (
    <div className="flex flex-col items-center">
      <p className="mb-4 max-w-md text-center text-sm text-neutral-500">
        Preview of the member app (Stage 2, Expo). Everything below runs on the same data as the CRM — viewed as member <span className="font-medium">{ME.name}</span>.
      </p>

      {/* phone frame */}
      <div className="relative h-[720px] w-[360px] overflow-hidden rounded-[2.5rem] border-8 border-neutral-900 bg-neutral-50 shadow-2xl">
        {/* splash: doors opening */}
        {splash && (
          <div className="absolute inset-0 z-50">
            <div className="absolute inset-y-0 left-0 w-1/2 bg-neutral-950 transition-transform duration-1000 delay-500 ease-in-out" style={{ transform: splash ? undefined : "translateX(-100%)", animation: "oxDoorL 1.2s 0.6s forwards" }} />
            <div className="absolute inset-y-0 right-0 w-1/2 bg-neutral-950" style={{ animation: "oxDoorR 1.2s 0.6s forwards" }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white" style={{ animation: "oxFade 0.8s 0.8s forwards" }}>
              <div className="text-4xl">🥊</div>
              <div className="mt-2 text-2xl font-bold tracking-tight">G1 Boxing</div>
              <div className="text-xs text-neutral-400">powered by OxRound</div>
            </div>
            <style>{`
              @keyframes oxDoorL { to { transform: translateX(-100%); } }
              @keyframes oxDoorR { to { transform: translateX(100%); } }
              @keyframes oxFade { to { opacity: 0; } }
            `}</style>
          </div>
        )}

        {/* header */}
        <div className="flex items-center justify-between bg-neutral-950 px-4 pb-3 pt-6 text-white">
          <div>
            <div className="text-xs text-neutral-400">G1 Boxing</div>
            <div className="text-sm font-semibold">{tab === "home" ? `Hey ${ME.name.split(" ")[0]} 👋` : tab === "schedule" ? "Schedule" : tab === "qr" ? "My QR" : "Profile"}</div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold">{ME.initials}</div>
        </div>

        {bookedMsg && <div className="bg-green-600 px-4 py-2 text-center text-xs font-medium text-white">{bookedMsg} ✓</div>}

        {/* content */}
        <div className="h-[560px] overflow-y-auto px-4 py-3">
          {tab === "home" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <div className="text-xs font-semibold uppercase text-neutral-400">Next class</div>
                {sessions[0] ? (
                  <div className="mt-1">
                    <div className="font-semibold">{sessions[0].class_name}</div>
                    <div className="text-sm text-neutral-500">{sessions[0].session_date} · {sessions[0].start_time.slice(0, 5)} · {sessions[0].coach_name}</div>
                    <button onClick={() => book(sessions[0])} className="mt-2 w-full rounded-lg bg-brand py-2 text-sm font-semibold text-white">Book a spot</button>
                  </div>
                ) : <div className="mt-1 text-sm text-neutral-400">No upcoming classes</div>}
              </div>
              <div className="text-xs font-semibold uppercase text-neutral-400">Announcements</div>
              {announcements.map((a) => (
                <div key={a.id} className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    {a.pinned && <span className="text-xs">📌</span>}
                    <span className="text-sm font-semibold">{a.title}</span>
                  </div>
                  {a.body && <p className="mt-1 text-xs text-neutral-600">{a.body}</p>}
                  <div className="mt-2 flex gap-3 text-xs text-neutral-400">
                    <span>👊 {a.reaction_count}</span><span>{a.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "schedule" && (
            <div className="space-y-2">
              {sessions.map((s) => {
                const c = counts[s.id] ?? { booked: 0, waitlisted: 0 };
                const spotsLeft = s.capacity != null ? s.capacity - c.booked : null;
                return (
                  <div key={s.id} className="rounded-xl bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{s.class_name}</div>
                        <div className="text-xs text-neutral-500">{s.session_date} · {s.start_time.slice(0, 5)} · {s.coach_name}</div>
                        <div className={`mt-0.5 text-xs font-medium ${spotsLeft !== null && spotsLeft <= 2 ? "text-red-600" : "text-green-700"}`}>
                          {spotsLeft === null ? "open gym" : spotsLeft <= 0 ? "full — waitlist" : `${spotsLeft} spots left`}
                        </div>
                      </div>
                      <button onClick={() => book(s)} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">
                        {spotsLeft !== null && spotsLeft <= 0 ? "Waitlist" : "Book"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "qr" && (
            <div className="flex h-full flex-col items-center justify-center">
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <QRCodeSVG value={`oxround:checkin:${ME.id}:demo-token`} size={200} />
              </div>
              <div className="mt-4 text-center">
                <div className="font-semibold">{ME.name}</div>
                <div className="text-xs text-neutral-500">Scan at the kiosk to check in</div>
                <div className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">Membership active ✓</div>
              </div>
            </div>
          )}

          {tab === "profile" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <div className="text-xs font-semibold uppercase text-neutral-400">Membership</div>
                <div className="mt-1 text-sm font-semibold">{membership?.plan_name ?? "—"}</div>
                <div className="text-xs text-neutral-500">
                  Status: {membership?.status ?? "—"} · Payment: {membership?.payment_status ?? "—"}
                  {membership?.next_billing_date && <> · renews {membership.next_billing_date}</>}
                </div>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <div className="text-xs font-semibold uppercase text-neutral-400">Recent visits ({visits.length} total)</div>
                {visits.slice(0, 8).map((v) => (
                  <div key={v.id} className="mt-1.5 flex items-center justify-between text-xs">
                    <span>{v.checked_in_at.slice(0, 10)}</span>
                    <span className="text-neutral-400">{v.checked_in_at.slice(11, 16)} · {v.method.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-white p-3 text-xs text-neutral-400 shadow-sm">
                Emergency contact, notifications, and language settings arrive with the real app (email OTP login, push).
              </div>
            </div>
          )}
        </div>

        {/* tab bar */}
        <div className="absolute inset-x-0 bottom-0 flex border-t border-neutral-200 bg-white">
          {([["home", "🏠", "Home"], ["schedule", "📅", "Schedule"], ["qr", "▣", "My QR"], ["profile", "👤", "Profile"]] as const).map(([key, icon, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex flex-1 flex-col items-center py-2.5 text-xs ${tab === key ? "font-semibold text-brand" : "text-neutral-400"}`}>
              <span className="text-base">{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
