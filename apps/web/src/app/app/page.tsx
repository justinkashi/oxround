"use client";
// Member web app (Step 6C + D-22). In real mode shows the signed-in member's own data;
// tabs: Home · MyOx · My QR · More (schedule + profile).
// My QR encodes "oxround:checkin:<id>" and is gated by payment status (D-20).

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  addBooking, bookingCounts, getCurrentMember, getMembership,
  listAnnouncements, listSessions, memberCheckIns, myMessages, myQrActive, sendMessage,
} from "@/lib/data";
import type { Announcement, CheckIn, ClassSession, GymMember, Membership, Message } from "@/lib/types";
import { useT } from "@/lib/i18n";

const iso = (d: Date) => d.toISOString().slice(0, 10);
type Tab = "home" | "community" | "myox" | "qr" | "more";

export default function MemberApp() {
  const t = useT();
  const [splash, setSplash] = useState(true);
  const [tab, setTab] = useState<Tab>("home");
  const [me, setMe] = useState<GymMember | null>(null);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [counts, setCounts] = useState<Record<string, { booked: number; waitlisted: number }>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [visits, setVisits] = useState<CheckIn[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [qr, setQr] = useState<{ active: boolean; reason?: string }>({ active: false });
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [bookedMsg, setBookedMsg] = useState("");

  useEffect(() => { const t = setTimeout(() => setSplash(false), 1800); return () => clearTimeout(t); }, []);

  const load = async () => {
    const member = await getCurrentMember();
    setMe(member);
    if (!member) return;
    const today = new Date();
    const end = new Date();
    end.setDate(today.getDate() + 7);
    const [ses, ann, chk, mem, q, msgs] = await Promise.all([
      listSessions(iso(today), iso(end)),
      listAnnouncements(),
      memberCheckIns(member.id),
      getMembership(member.id),
      myQrActive(),
      myMessages(),
    ]);
    const upcoming = ses.filter((s) => s.status === "scheduled");
    setSessions(upcoming);
    setCounts(await bookingCounts(upcoming.map((s) => s.id)));
    setAnnouncements(ann);
    setVisits(chk);
    setMembership(mem);
    setQr(q);
    setMessages(msgs);
  };

  const send = async () => {
    if (!draft.trim()) return;
    await sendMessage({ recipient_member_id: null, body: draft.trim(), is_broadcast: false });
    setDraft("");
    load();
  };
  useEffect(() => { load(); }, []);

  const book = async (s: ClassSession) => {
    if (!me) return;
    await addBooking(s.id, me.id);
    setBookedMsg(t.memberApp.booked(s.class_name, s.session_date, s.start_time.slice(0, 5)));
    setTimeout(() => setBookedMsg(""), 2500);
    load();
  };

  // ---- MyOx analytics (D-22), computed from this member's check-ins ----
  const stats = useMemo(() => {
    const now = Date.now();
    const days = (isoStr: string) => (now - new Date(isoStr).getTime()) / 86400000;
    const last30 = visits.filter((v) => days(v.checked_in_at) <= 30).length;
    const prev30 = visits.filter((v) => days(v.checked_in_at) > 30 && days(v.checked_in_at) <= 60).length;
    const thisWeek = visits.filter((v) => days(v.checked_in_at) <= 7).length;
    const lastWeek = visits.filter((v) => days(v.checked_in_at) > 7 && days(v.checked_in_at) <= 14).length;
    let streak = 0;
    for (let w = 0; w < 12; w++) {
      if (visits.some((v) => days(v.checked_in_at) >= w * 7 && days(v.checked_in_at) < (w + 1) * 7)) streak++;
      else break;
    }
    const milestones = [10, 25, 50, 100, 250];
    const nextMilestone = milestones.find((m) => m > visits.length) ?? null;
    return { total: visits.length, last30, prev30, thisWeek, lastWeek, streak, nextMilestone };
  }, [visits]);

  const firstName = me?.first_name ?? "";
  const initials = `${me?.first_name?.[0] ?? ""}${me?.last_name?.[0] ?? ""}`;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[720px] w-[360px] overflow-hidden rounded-[2.5rem] border-8 border-neutral-900 bg-neutral-50 shadow-2xl">
        {splash && (
          <div className="absolute inset-0 z-50">
            <div className="absolute inset-y-0 left-0 w-1/2 bg-neutral-950" style={{ animation: "oxDoorL 1.2s 0.6s forwards" }} />
            <div className="absolute inset-y-0 right-0 w-1/2 bg-neutral-950" style={{ animation: "oxDoorR 1.2s 0.6s forwards" }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white" style={{ animation: "oxFade 0.8s 0.8s forwards" }}>
              <div className="text-4xl">🥊</div>
              <div className="mt-2 text-2xl font-bold tracking-tight">G1 Boxing</div>
              <div className="text-xs text-neutral-400">{t.memberApp.poweredBy}</div>
            </div>
            <style>{`@keyframes oxDoorL{to{transform:translateX(-100%)}}@keyframes oxDoorR{to{transform:translateX(100%)}}@keyframes oxFade{to{opacity:0}}`}</style>
          </div>
        )}

        <div className="flex items-center justify-between bg-neutral-950 px-4 pb-3 pt-6 text-white">
          <div>
            <div className="text-xs text-neutral-400">G1 Boxing</div>
            <div className="text-sm font-semibold">
              {tab === "home" ? t.memberApp.hey(firstName) : t.memberApp.tabTitles[tab]}
            </div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold">{initials}</div>
        </div>

        {bookedMsg && <div className="bg-green-600 px-4 py-2 text-center text-xs font-medium text-white">{bookedMsg} ✓</div>}

        <div className="h-[560px] overflow-y-auto px-4 py-3">
          {!me ? (
            <div className="py-10 text-center text-sm text-neutral-400">{t.memberApp.noMembership}</div>
          ) : tab === "home" ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <div className="text-xs font-semibold uppercase text-neutral-400">{t.memberApp.nextClass}</div>
                {sessions[0] ? (
                  <div className="mt-1">
                    <div className="font-semibold">{sessions[0].class_name}</div>
                    <div className="text-sm text-neutral-500">{sessions[0].session_date} · {sessions[0].start_time.slice(0, 5)} · {sessions[0].coach_name}</div>
                    <button onClick={() => book(sessions[0])} className="mt-2 w-full rounded-lg bg-brand py-2 text-sm font-semibold text-white">{t.memberApp.bookSpot}</button>
                  </div>
                ) : <div className="mt-1 text-sm text-neutral-400">{t.memberApp.noUpcomingClasses}</div>}
              </div>
              <div className="text-xs font-semibold uppercase text-neutral-400">{t.memberApp.announcements}</div>
              {announcements.map((a) => (
                <div key={a.id} className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2">{a.pinned && <span className="text-xs">📌</span>}<span className="text-sm font-semibold">{a.title}</span></div>
                  {a.body && <p className="mt-1 text-xs text-neutral-600">{a.body}</p>}
                  <div className="mt-2 flex gap-3 text-xs text-neutral-400"><span>👊 {a.reaction_count}</span><span>{t.labels.announcementType[a.type]}</span></div>
                </div>
              ))}
            </div>
          ) : tab === "community" ? (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-neutral-400">{t.memberApp.gymFeed}</div>
              {announcements.map((a) => (
                <div key={a.id} className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2">{a.pinned && <span className="text-xs">📌</span>}<span className="text-sm font-semibold">{a.title}</span></div>
                  {a.body && <p className="mt-1 text-xs text-neutral-600">{a.body}</p>}
                  <div className="mt-2 text-xs text-neutral-400">👊 {a.reaction_count} · {t.labels.announcementType[a.type]}</div>
                </div>
              ))}
              <div className="mt-4 text-xs font-semibold uppercase text-neutral-400">{t.memberApp.messagesWithGym}</div>
              <div className="space-y-2 rounded-xl bg-white p-3 shadow-sm">
                {messages.length === 0 && <div className="py-2 text-center text-xs text-neutral-400">{t.memberApp.noMessages}</div>}
                {messages.map((m) => {
                  const fromMe = m.sender_member_id === me?.id;
                  return (
                    <div key={m.id} className={`flex ${fromMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-1.5 text-xs ${m.is_broadcast ? "bg-blue-50 text-blue-800" : fromMe ? "bg-brand text-white" : "bg-neutral-100"}`}>
                        {m.is_broadcast && <div className="text-[10px] font-semibold uppercase opacity-70">{t.memberApp.broadcastLabel(m.sender_name)}</div>}
                        {m.body}
                      </div>
                    </div>
                  );
                })}
                <div className="flex gap-2 pt-1">
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={t.memberApp.messageGym} className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-xs" />
                  <button onClick={send} className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white">{t.memberApp.send}</button>
                </div>
              </div>
            </div>
          ) : tab === "myox" ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-gradient-to-br from-brand to-red-700 p-4 text-white shadow-sm">
                <div className="text-xs uppercase opacity-80">{t.memberApp.currentStreak}</div>
                <div className="text-3xl font-bold">🔥 {t.memberApp.weeks(stats.streak)}</div>
                <div className="text-xs opacity-90">{stats.thisWeek >= stats.lastWeek ? t.memberApp.keepGoing : t.memberApp.beatLastWeek(stats.lastWeek - stats.thisWeek + 1)}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-3 text-center shadow-sm"><div className="text-2xl font-bold">{stats.last30}</div><div className="text-xs text-neutral-500">{t.memberApp.visitsThisMonth}</div></div>
                <div className="rounded-xl bg-white p-3 text-center shadow-sm"><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-neutral-500">{t.memberApp.classesAllTime}</div></div>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <div className="text-xs font-semibold uppercase text-neutral-400">{t.memberApp.milestones}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[10, 25, 50, 100, 250].map((m) => (
                    <span key={m} className={`rounded-full px-3 py-1 text-xs font-medium ${stats.total >= m ? "bg-brand text-white" : "bg-neutral-100 text-neutral-400"}`}>
                      {stats.total >= m ? "🏅" : ""} {m}
                    </span>
                  ))}
                </div>
                {stats.nextMilestone && <div className="mt-2 text-xs text-neutral-500">{t.memberApp.nextBadge(stats.nextMilestone - stats.total)}</div>}
              </div>
              <div className="rounded-xl bg-white p-3 text-xs text-neutral-500 shadow-sm">
                {stats.last30 >= stats.prev30 ? t.memberApp.trainingUp : t.memberApp.trainingDown}
              </div>
            </div>
          ) : tab === "qr" ? (
            <div className="flex h-full flex-col items-center justify-center">
              {qr.active ? (
                <>
                  <div className="rounded-2xl bg-white p-6 shadow-sm">
                    <QRCodeSVG value={`oxround:checkin:${me.id}`} size={200} />
                  </div>
                  <div className="mt-4 text-center">
                    <div className="font-semibold">{me.first_name} {me.last_name}</div>
                    <div className="text-xs text-neutral-500">{t.memberApp.scanAtDesk}</div>
                    <div className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">{t.memberApp.membershipActive}</div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
                  <div className="text-4xl">🔒</div>
                  <div className="mt-2 font-semibold">{t.memberApp.qrNotActive}</div>
                  <div className="mt-1 text-sm text-neutral-600">{qr.reason}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-neutral-400">{t.memberApp.schedule}</div>
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
                          {spotsLeft === null ? t.memberApp.openGym : spotsLeft <= 0 ? t.memberApp.fullWaitlist : t.memberApp.spotsLeft(spotsLeft)}
                        </div>
                      </div>
                      <button onClick={() => book(s)} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">
                        {spotsLeft !== null && spotsLeft <= 0 ? t.memberApp.waitlist : t.memberApp.book}
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 text-xs font-semibold uppercase text-neutral-400">{t.memberApp.profile}</div>
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <div className="text-sm font-semibold">{membership?.plan_name ?? "—"}</div>
                <div className="text-xs text-neutral-500">
                  {t.memberApp.statusPayment(membership?.status ? t.labels.membershipStatus[membership.status] : "—", membership?.payment_status ? t.labels.paymentStatus[membership.payment_status] : "—")}
                  {membership?.next_billing_date && ` · ${t.memberApp.renews(membership.next_billing_date)}`}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 flex border-t border-neutral-200 bg-white">
          {([["home", "🏠"], ["community", "💬"], ["myox", "🔥"], ["qr", "▣"], ["more", "⋯"]] as const).map(([key, icon]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex flex-1 flex-col items-center py-2.5 text-xs ${tab === key ? "font-semibold text-brand" : "text-neutral-400"}`}>
              <span className="text-base">{icon}</span>{t.memberApp.bottomTabs[key]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
