// Data layer. Uses Supabase when NEXT_PUBLIC_SUPABASE_URL is set; otherwise the
// in-memory demo dataset (mutations persist for the browser session — enough for the G1 demo).
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Announcement, BookingStatus, CheckIn, ClassBooking, ClassSession, GymClass, GymMember,
  GymSettings, Lead, LeadStatus, MemberAttendanceSummary, Membership, MembershipPlan,
  Message, Payment, PaymentStatus,
} from "./types";

// Grace period before a past-due member is treated as overdue (D-20). Default 7 days.
export const GRACE_PERIOD_DAYS = 7;
import {
  demoAnnouncements, demoBookings, demoCheckIns, demoClasses, demoLeads, demoMembers,
  demoMemberships, demoPayments, demoPlans, demoSessions, demoSettings,
} from "./demo-data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const isDemoMode = !url || !anon;

// Cookie-based client (@supabase/ssr) so the middleware route guard sees the session.
let sb: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!sb) sb = createBrowserClient(url!, anon!);
  return sb;
}

// ---- current user: roles + member identity (Step 6A/6C) ----

function rolesFromToken(token: string | undefined): string[] {
  if (!token) return [];
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(payload));
    return Array.isArray(json.roles) ? json.roles : [];
  } catch {
    return [];
  }
}

// Roles of the signed-in user. Demo mode = owner (so the CRM is fully visible).
export async function getMyRoles(): Promise<string[]> {
  if (isDemoMode) return ["owner"];
  const { data: { session } } = await supabase().auth.getSession();
  return rolesFromToken(session?.access_token);
}

export const STAFF_ROLES = ["owner", "manager", "coach", "receptionist"];
export async function isStaffUser(): Promise<boolean> {
  const r = await getMyRoles();
  return r.some((x) => STAFF_ROLES.includes(x));
}

// The signed-in member's own gym_members row. Demo = Marco (m1).
export async function getCurrentMember(): Promise<GymMember | null> {
  if (isDemoMode) return state.members.find((m) => m.id === "m1") ?? null;
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) return null;
  const { data } = await supabase().from("gym_members").select("*").eq("user_id", user.id).maybeSingle();
  return (data as GymMember | null) ?? null;
}

// ---- session-mutable demo state ----
const state = {
  members: [...demoMembers],
  memberships: [...demoMemberships],
  checkIns: [...demoCheckIns],
  announcements: [...demoAnnouncements],
  plans: [...demoPlans],
  classes: [...demoClasses],
  sessions: [...demoSessions],
  bookings: [...demoBookings],
  payments: [...demoPayments],
  leads: [...demoLeads],
  settings: { ...demoSettings },
  messages: [
    { id: "msg1", sender_member_id: "m6", sender_name: "Tony Bélanger", recipient_member_id: null, body: "Reminder: no sparring class this Friday — coach away.", is_broadcast: true, created_at: new Date(Date.now() - 2 * 86400000).toISOString(), read_at: null },
    { id: "msg2", sender_member_id: "m1", sender_name: "Marco Silva", recipient_member_id: null, body: "Hey, can I freeze my membership for July? Traveling.", is_broadcast: false, created_at: new Date(Date.now() - 86400000).toISOString(), read_at: null },
  ] as Message[],
};

export async function listMembers(): Promise<GymMember[]> {
  if (isDemoMode) return state.members.filter((m) => m.status !== "archived");
  const { data, error } = await supabase()
    .from("gym_members")
    .select("*")
    .neq("status", "archived")
    .order("first_name");
  if (error) throw error;
  return data as GymMember[];
}

export async function getMember(id: string): Promise<GymMember | null> {
  if (isDemoMode) return state.members.find((m) => m.id === id) ?? null;
  const { data } = await supabase().from("gym_members").select("*").eq("id", id).maybeSingle();
  return data as GymMember | null;
}

export async function getMembership(memberId: string): Promise<Membership | null> {
  if (isDemoMode) return state.memberships.find((s) => s.gym_member_id === memberId) ?? null;
  const { data } = await supabase()
    .from("memberships")
    .select("*, membership_plans(name)")
    .eq("gym_member_id", memberId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  const d = data as Record<string, unknown> & { membership_plans?: { name: string } };
  return { ...(d as unknown as Membership), plan_name: d.membership_plans?.name ?? "—" };
}

export async function setPaymentStatus(memberId: string, status: PaymentStatus): Promise<void> {
  if (isDemoMode) {
    const s = state.memberships.find((x) => x.gym_member_id === memberId);
    if (s) s.payment_status = status;
    return;
  }
  await supabase().from("memberships").update({ payment_status: status }).eq("gym_member_id", memberId).eq("status", "active");
}

// A3 Interconnected: archive (soft-delete, D-03) — check-in function rejects non-active members.
export async function setMemberStatus(memberId: string, status: GymMember["status"]): Promise<void> {
  if (isDemoMode) {
    const m = state.members.find((x) => x.id === memberId);
    if (m) m.status = status;
    return;
  }
  await supabase().from("gym_members").update({ status }).eq("id", memberId);
}

export async function createMember(input: { first_name: string; last_name: string; email: string; phone: string }): Promise<GymMember> {
  if (isDemoMode) {
    const m: GymMember = {
      id: `m${Date.now()}`, gym_id: "g1", roles: ["member"], status: "active",
      joined_at: new Date().toISOString().slice(0, 10), emergency_contact: null,
      first_name: input.first_name, last_name: input.last_name || null,
      email: input.email || null, phone: input.phone || null,
    };
    state.members.push(m);
    return m;
  }
  // Real mode: raw token generated client-side ONCE for the QR; only SHA-256 stored (D-02).
  const raw = crypto.randomUUID() + crypto.randomUUID();
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const { data, error } = await supabase()
    .from("gym_members")
    .insert({ ...input, roles: ["member"], check_in_token_hash: hash })
    .select()
    .single();
  if (error) throw error;
  const member = data as GymMember;
  // D-24: new member starts UNPAID — a pending membership so their QR stays gated (D-20)
  // until the owner records the first payment. (No plan_id yet; owner assigns on the plan.)
  await supabase().from("memberships").insert({
    gym_id: member.gym_id, gym_member_id: member.id,
    status: "active", payment_status: "pending", start_date: new Date().toISOString().slice(0, 10),
  });
  // Caller is responsible for showing/printing `raw` immediately — it is not retrievable later.
  (data as Record<string, unknown>).__raw_token = raw;
  return member;
}

export async function listCheckIns(limit = 20): Promise<CheckIn[]> {
  if (isDemoMode) return state.checkIns.slice(0, limit);
  const { data, error } = await supabase()
    .from("check_ins")
    .select("id, gym_member_id, method, checked_in_at, gym_members(first_name, last_name)")
    .order("checked_in_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as Array<Record<string, unknown> & { gym_members: { first_name: string; last_name: string | null } }>).map((r) => ({
    id: r.id as string,
    gym_member_id: r.gym_member_id as string,
    member_name: `${r.gym_members.first_name} ${r.gym_members.last_name ?? ""}`.trim(),
    method: r.method as CheckIn["method"],
    checked_in_at: r.checked_in_at as string,
  }));
}

export async function memberCheckIns(memberId: string): Promise<CheckIn[]> {
  if (isDemoMode) return state.checkIns.filter((c) => c.gym_member_id === memberId);
  const { data } = await supabase()
    .from("check_ins")
    .select("id, gym_member_id, method, checked_in_at")
    .eq("gym_member_id", memberId)
    .order("checked_in_at", { ascending: false });
  return ((data ?? []) as Array<Omit<CheckIn, "member_name">>).map((c) => ({ ...c, member_name: "" }));
}

// A2 Logs + "user-loss in numbers" (logs.md July 2): per-member summary with drop-off detection.
export async function attendanceSummaries(): Promise<MemberAttendanceSummary[]> {
  const members = await listMembers();
  const all = isDemoMode ? state.checkIns : await listCheckIns(2000);
  const now = Date.now();
  const days = (iso: string) => (now - new Date(iso).getTime()) / 86400000;
  return members
    .filter((m) => m.roles.includes("member"))
    .map((m) => {
      const mine = all.filter((c) => c.gym_member_id === m.id);
      const last30 = mine.filter((c) => days(c.checked_in_at) <= 30).length;
      const prev30 = mine.filter((c) => days(c.checked_in_at) > 30 && days(c.checked_in_at) <= 60).length;
      let streak = 0;
      for (let w = 0; w < 12; w++) {
        const hits = mine.some((c) => days(c.checked_in_at) >= w * 7 && days(c.checked_in_at) < (w + 1) * 7);
        if (hits) streak++;
        else break;
      }
      return {
        member: m,
        visitsLast30: last30,
        visitsPrev30: prev30,
        streakWeeks: streak,
        totalVisits: mine.length,
        lastVisit: mine[0]?.checked_in_at ?? null,
      };
    })
    .sort((a, b) => b.visitsLast30 - a.visitsLast30);
}

export async function recordManualCheckIn(memberId: string): Promise<void> {
  const m = await getMember(memberId);
  if (!m) return;
  if (isDemoMode) {
    state.checkIns.unshift({
      id: `c${Date.now()}`, gym_member_id: memberId,
      member_name: `${m.first_name} ${m.last_name ?? ""}`.trim(),
      method: "manual_staff", checked_in_at: new Date().toISOString(),
    });
    return;
  }
  await supabase().from("check_ins").insert({ gym_id: m.gym_id, gym_member_id: memberId, method: "manual_staff" });
}

// Scanner check-in (Step 6D). Validates active + paid (D-20 gate) then records the visit.
// Called by the CRM scanner (staff-authenticated). Returns a result for the green/red screen.
export type CheckInResult = { ok: boolean; name: string; reason?: string; duplicate?: boolean };

export async function checkInMember(memberId: string): Promise<CheckInResult> {
  const m = await getMember(memberId);
  if (!m) return { ok: false, name: "", reason: "Unknown code" };
  const name = `${m.first_name} ${m.last_name ?? ""}`.trim();
  if (m.status !== "active") return { ok: false, name, reason: "Membership inactive" };

  const s = await getMembership(memberId);
  if (s && s.payment_status === "overdue") return { ok: false, name, reason: "Payment due" };

  // Duplicate-scan window: ignore a second scan within 1 hour (D-20 hardening).
  const recent = await memberCheckIns(memberId);
  const lastIso = recent[0]?.checked_in_at;
  if (lastIso && Date.now() - new Date(lastIso).getTime() < 60 * 60 * 1000) {
    return { ok: true, name, duplicate: true };
  }

  if (isDemoMode) {
    state.checkIns.unshift({
      id: `c${Date.now()}`, gym_member_id: memberId, member_name: name,
      method: "qr_phone", checked_in_at: new Date().toISOString(),
    });
    return { ok: true, name };
  }
  const { error } = await supabase().from("check_ins").insert({ gym_id: m.gym_id, gym_member_id: memberId, method: "qr_phone" });
  if (error) return { ok: false, name, reason: error.message };
  return { ok: true, name };
}

// Whether the signed-in member's QR should be active (D-20): active + not overdue.
export async function myQrActive(): Promise<{ active: boolean; reason?: string }> {
  const m = await getCurrentMember();
  if (!m) return { active: false, reason: "No membership found" };
  if (m.status !== "active") return { active: false, reason: "Membership inactive" };
  const s = await getMembership(m.id);
  if (s && s.payment_status === "overdue") return { active: false, reason: "Payment due — see the front desk" };
  return { active: true };
}

// Owner/staff system notifications (Step 6F, D-23) — derived live from existing analytics.
// At-risk members (drop-off) + overdue payments. No new tables needed.
export type OwnerNotification = { id: string; kind: "at_risk" | "overdue"; text: string; href: string };

export async function getOwnerNotifications(): Promise<OwnerNotification[]> {
  const out: OwnerNotification[] = [];
  const summaries = await attendanceSummaries();
  for (const s of summaries) {
    if (s.visitsPrev30 > 0 && s.visitsLast30 < s.visitsPrev30 / 2) {
      out.push({
        id: `risk-${s.member.id}`, kind: "at_risk",
        text: `${s.member.first_name} ${s.member.last_name ?? ""} is fading — ${s.visitsPrev30}→${s.visitsLast30} visits`,
        href: `/members/view?id=${s.member.id}`,
      });
    }
  }
  const members = await listMembers();
  for (const m of members) {
    const s = await getMembership(m.id);
    if (s?.payment_status === "overdue") {
      out.push({ id: `due-${m.id}`, kind: "overdue", text: `${m.first_name} ${m.last_name ?? ""} — payment overdue`, href: `/members/view?id=${m.id}` });
    }
  }
  return out;
}

// ============ MESSAGING (Step 6F / D-23) ============

function mapMessages(rows: Array<Record<string, unknown> & { gym_members?: { first_name: string; last_name: string | null } | null }>): Message[] {
  return rows.map((r) => ({
    id: r.id as string,
    sender_member_id: r.sender_member_id as string,
    sender_name: r.gym_members ? `${r.gym_members.first_name} ${r.gym_members.last_name ?? ""}`.trim() : "",
    recipient_member_id: (r.recipient_member_id as string | null) ?? null,
    body: r.body as string,
    is_broadcast: r.is_broadcast as boolean,
    created_at: r.created_at as string,
    read_at: (r.read_at as string | null) ?? null,
  }));
}

// Member view: their 1:1 thread with the gym + broadcasts, oldest→newest.
export async function myMessages(): Promise<Message[]> {
  if (isDemoMode) {
    const meId = "m1";
    return state.messages
      .filter((m) => m.is_broadcast || m.sender_member_id === meId || m.recipient_member_id === meId || (m.recipient_member_id === null && !m.is_broadcast))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  const { data, error } = await supabase()
    .from("messages")
    .select("*, gym_members!messages_sender_member_id_fkey(first_name, last_name)")
    .order("created_at");
  if (error) throw error;
  return mapMessages(data as never[]);
}

// Member (or staff) sends a message. Broadcast only allowed for staff (RLS enforces).
export async function sendMessage(input: { recipient_member_id: string | null; body: string; is_broadcast: boolean }): Promise<void> {
  if (isDemoMode) {
    const me = state.members.find((m) => m.id === "m1");
    state.messages.push({
      id: `msg${Date.now()}`, sender_member_id: "m1",
      sender_name: me ? `${me.first_name} ${me.last_name ?? ""}`.trim() : "You",
      recipient_member_id: input.recipient_member_id, body: input.body,
      is_broadcast: input.is_broadcast, created_at: new Date().toISOString(), read_at: null,
    });
    return;
  }
  const meId = await currentMemberId();
  const { error } = await supabase().from("messages").insert({
    gym_id: (await getCurrentMember())?.gym_id, sender_member_id: meId,
    recipient_member_id: input.recipient_member_id, body: input.body, is_broadcast: input.is_broadcast,
  });
  if (error) throw error;
}

// Staff sends to a specific member (reply) or broadcast.
export async function staffSendMessage(input: { recipient_member_id: string | null; body: string; is_broadcast: boolean }): Promise<void> {
  return sendMessage(input);
}

// Staff CRM view: all gym messages, newest first (thread-grouping done in the UI).
export async function staffListMessages(): Promise<Message[]> {
  if (isDemoMode) return [...state.messages].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { data, error } = await supabase()
    .from("messages")
    .select("*, gym_members!messages_sender_member_id_fkey(first_name, last_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return mapMessages(data as never[]);
}

async function currentMemberId(): Promise<string | null> {
  if (isDemoMode) return "m1";
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) return null;
  const { data } = await supabase().from("gym_members").select("id").eq("user_id", user.id).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// Invite a member to the app (Step 6G): triggers the invite-member Edge Function (sends email + links account).
export async function inviteMemberEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  if (isDemoMode) return { ok: true };
  const { data, error } = await supabase().functions.invoke("invite-member", { body: { email } });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}

export async function listAnnouncements(): Promise<Announcement[]> {
  if (isDemoMode) return [...state.announcements].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.published_at.localeCompare(a.published_at));
  const { data } = await supabase().from("announcements").select("*").order("pinned", { ascending: false }).order("published_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((a) => ({
    ...(a as unknown as Announcement),
    read_count: 0,
    reaction_count: 0,
    media_urls: (a.media_urls as string[]) ?? [],
  }));
}

export async function createAnnouncement(input: { title: string; body: string; type: Announcement["type"]; pinned: boolean }): Promise<void> {
  if (isDemoMode) {
    state.announcements.unshift({ id: `a${Date.now()}`, published_at: new Date().toISOString(), read_count: 0, reaction_count: 0, media_urls: [], ...input });
    return;
  }
  const { error } = await supabase().from("announcements").insert(input);
  if (error) throw error;
}

// ============ MEMBERSHIP PLANS ============

export async function listPlans(): Promise<MembershipPlan[]> {
  if (isDemoMode) return state.plans;
  const { data, error } = await supabase().from("membership_plans").select("*").order("created_at");
  if (error) throw error;
  return data as MembershipPlan[];
}

export async function createPlan(input: Omit<MembershipPlan, "id" | "gym_id" | "is_active">): Promise<void> {
  if (isDemoMode) {
    state.plans.push({ ...input, id: `p${Date.now()}`, gym_id: "g1", is_active: true });
    return;
  }
  const { error } = await supabase().from("membership_plans").insert(input);
  if (error) throw error;
}

export async function setPlanActive(planId: string, isActive: boolean): Promise<void> {
  if (isDemoMode) {
    const p = state.plans.find((x) => x.id === planId);
    if (p) p.is_active = isActive;
    return;
  }
  await supabase().from("membership_plans").update({ is_active: isActive }).eq("id", planId);
}

// ============ CLASSES & SESSIONS ============

export async function listClasses(): Promise<GymClass[]> {
  if (isDemoMode) return state.classes.filter((c) => c.is_active);
  const { data, error } = await supabase().from("classes").select("*").eq("is_active", true).order("start_time");
  if (error) throw error;
  return data as GymClass[];
}

export async function createClass(input: Omit<GymClass, "id" | "gym_id" | "is_active">): Promise<void> {
  if (isDemoMode) {
    const cl: GymClass = { ...input, id: `cl${Date.now()}`, gym_id: "g1", is_active: true };
    state.classes.push(cl);
    // regenerate demo sessions for the next 14 days for this class
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const coach = state.members.find((m) => m.id === cl.coach_id);
    for (let d = 0; d < 14; d++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + d);
      if (!cl.day_of_week.includes(day.getDay())) continue;
      state.sessions.push({
        id: `ses${Date.now()}-${d}`, class_id: cl.id, class_name: cl.name,
        session_date: day.toISOString().slice(0, 10), start_time: cl.start_time,
        duration_mins: cl.duration_mins, capacity: cl.capacity, coach_id: cl.coach_id,
        coach_name: coach ? `${coach.first_name} ${coach.last_name ?? ""}`.trim() : "—",
        status: "scheduled", color: cl.color,
      });
    }
    state.sessions.sort((a, b) => a.session_date.localeCompare(b.session_date) || a.start_time.localeCompare(b.start_time));
    return;
  }
  const { error } = await supabase().from("classes").insert(input);
  if (error) throw error;
}

export async function deactivateClass(classId: string): Promise<void> {
  if (isDemoMode) {
    const c = state.classes.find((x) => x.id === classId);
    if (c) c.is_active = false;
    state.sessions = state.sessions.filter((s) => s.class_id !== classId || s.session_date < new Date().toISOString().slice(0, 10));
    return;
  }
  await supabase().from("classes").update({ is_active: false }).eq("id", classId);
}

export async function listSessions(fromISO: string, toISO: string): Promise<ClassSession[]> {
  if (isDemoMode) return state.sessions.filter((s) => s.session_date >= fromISO && s.session_date <= toISO);
  const { data, error } = await supabase()
    .from("class_sessions")
    .select("*, classes(name, color), gym_members(first_name, last_name)")
    .gte("session_date", fromISO)
    .lte("session_date", toISO)
    .order("session_date")
    .order("start_time");
  if (error) throw error;
  return (data as unknown as Array<Record<string, unknown> & { classes: { name: string; color: string | null }; gym_members: { first_name: string; last_name: string | null } | null }>).map((r) => ({
    id: r.id as string, class_id: r.class_id as string, class_name: r.classes.name,
    session_date: r.session_date as string, start_time: r.start_time as string,
    duration_mins: r.duration_mins as number, capacity: r.capacity as number | null,
    coach_id: r.coach_id as string | null,
    coach_name: r.gym_members ? `${r.gym_members.first_name} ${r.gym_members.last_name ?? ""}`.trim() : "—",
    status: r.status as ClassSession["status"], color: r.classes.color,
  }));
}

export async function getSession(sessionId: string): Promise<ClassSession | null> {
  if (isDemoMode) return state.sessions.find((s) => s.id === sessionId) ?? null;
  const all = await listSessions("1970-01-01", "2999-12-31");
  return all.find((s) => s.id === sessionId) ?? null;
}

export async function cancelSession(sessionId: string): Promise<void> {
  if (isDemoMode) {
    const s = state.sessions.find((x) => x.id === sessionId);
    if (s) s.status = "canceled";
    return;
  }
  await supabase().from("class_sessions").update({ status: "canceled" }).eq("id", sessionId);
}

// ============ BOOKINGS ============

export async function sessionBookings(sessionId: string): Promise<ClassBooking[]> {
  if (isDemoMode) return state.bookings.filter((b) => b.session_id === sessionId && b.status !== "canceled");
  const { data, error } = await supabase()
    .from("class_bookings")
    .select("*, gym_members(first_name, last_name)")
    .eq("session_id", sessionId)
    .neq("status", "canceled");
  if (error) throw error;
  return (data as unknown as Array<Record<string, unknown> & { gym_members: { first_name: string; last_name: string | null } }>).map((r) => ({
    id: r.id as string, session_id: r.session_id as string, gym_member_id: r.gym_member_id as string,
    member_name: `${r.gym_members.first_name} ${r.gym_members.last_name ?? ""}`.trim(),
    status: r.status as BookingStatus, booked_at: r.booked_at as string,
  }));
}

export async function bookingCounts(sessionIds: string[]): Promise<Record<string, { booked: number; waitlisted: number }>> {
  const out: Record<string, { booked: number; waitlisted: number }> = {};
  for (const id of sessionIds) out[id] = { booked: 0, waitlisted: 0 };
  const rows = isDemoMode
    ? state.bookings.filter((b) => sessionIds.includes(b.session_id))
    : ((await supabase().from("class_bookings").select("session_id, status").in("session_id", sessionIds)).data as Array<{ session_id: string; status: BookingStatus }> | null) ?? [];
  for (const b of rows) {
    if (!out[b.session_id]) continue;
    if (b.status === "booked" || b.status === "attended") out[b.session_id].booked++;
    if (b.status === "waitlisted") out[b.session_id].waitlisted++;
  }
  return out;
}

export async function addBooking(sessionId: string, memberId: string): Promise<void> {
  const session = await getSession(sessionId);
  const existing = await sessionBookings(sessionId);
  const full = session?.capacity != null && existing.filter((b) => b.status === "booked" || b.status === "attended").length >= session.capacity;
  const status: BookingStatus = full ? "waitlisted" : "booked";
  if (isDemoMode) {
    const m = state.members.find((x) => x.id === memberId);
    if (!m || existing.some((b) => b.gym_member_id === memberId)) return;
    state.bookings.push({
      id: `b${Date.now()}`, session_id: sessionId, gym_member_id: memberId,
      member_name: `${m.first_name} ${m.last_name ?? ""}`.trim(), status, booked_at: new Date().toISOString(),
    });
    return;
  }
  await supabase().from("class_bookings").insert({ session_id: sessionId, gym_member_id: memberId, status });
}

export async function setBookingStatus(bookingId: string, status: BookingStatus): Promise<void> {
  if (isDemoMode) {
    const b = state.bookings.find((x) => x.id === bookingId);
    if (b) b.status = status;
    return;
  }
  await supabase().from("class_bookings").update({ status }).eq("id", bookingId);
}

// ============ COACHES ============

export async function listCoaches(): Promise<GymMember[]> {
  if (isDemoMode) return state.members.filter((m) => m.status === "active" && (m.roles.includes("coach") || m.roles.includes("owner") || m.roles.includes("manager")));
  const { data, error } = await supabase().from("gym_members").select("*").eq("status", "active").overlaps("roles", ["coach", "owner", "manager"]).order("first_name");
  if (error) throw error;
  return data as GymMember[];
}

export async function setMemberRoles(memberId: string, roles: GymMember["roles"]): Promise<void> {
  if (isDemoMode) {
    const m = state.members.find((x) => x.id === memberId);
    if (m) m.roles = roles;
    return;
  }
  await supabase().from("gym_members").update({ roles }).eq("id", memberId);
}

// ============ PAYMENTS ============

export async function listPayments(): Promise<Payment[]> {
  if (isDemoMode) return state.payments;
  const { data, error } = await supabase()
    .from("payments")
    .select("*, gym_members(first_name, last_name)")
    .order("paid_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as Array<Record<string, unknown> & { gym_members: { first_name: string; last_name: string | null } }>).map((r) => ({
    id: r.id as string, gym_member_id: r.gym_member_id as string,
    member_name: `${r.gym_members.first_name} ${r.gym_members.last_name ?? ""}`.trim(),
    amount_cents: r.amount_cents as number, method: r.method as Payment["method"],
    paid_at: r.paid_at as string, notes: (r.notes as string | null) ?? null,
  }));
}

export async function recordPayment(input: { gym_member_id: string; amount_cents: number; method: Payment["method"]; notes: string | null }): Promise<void> {
  if (isDemoMode) {
    const m = state.members.find((x) => x.id === input.gym_member_id);
    state.payments.unshift({
      id: `pay${Date.now()}`, ...input,
      member_name: m ? `${m.first_name} ${m.last_name ?? ""}`.trim() : "—",
      paid_at: new Date().toISOString().slice(0, 10),
    });
    // recording a payment marks the active membership paid
    const s = state.memberships.find((x) => x.gym_member_id === input.gym_member_id);
    if (s) s.payment_status = "paid";
    return;
  }
  const { error } = await supabase().from("payments").insert(input);
  if (error) throw error;
  await supabase().from("memberships").update({ payment_status: "paid" }).eq("gym_member_id", input.gym_member_id).eq("status", "active");
}

// ============ LEADS ============

export async function listLeads(): Promise<Lead[]> {
  if (isDemoMode) return state.leads;
  const { data, error } = await supabase().from("leads").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Lead[];
}

export async function createLead(input: { first_name: string; last_name: string; email: string; phone: string; source: Lead["source"]; notes: string }): Promise<void> {
  if (isDemoMode) {
    state.leads.unshift({
      id: `l${Date.now()}`, first_name: input.first_name, last_name: input.last_name || null,
      email: input.email || null, phone: input.phone || null, source: input.source,
      status: "new", follow_up_date: null, notes: input.notes || null, created_at: new Date().toISOString(),
    });
    return;
  }
  const { error } = await supabase().from("leads").insert(input);
  if (error) throw error;
}

export async function setLeadStatus(leadId: string, status: LeadStatus): Promise<void> {
  if (isDemoMode) {
    const l = state.leads.find((x) => x.id === leadId);
    if (l) l.status = status;
    return;
  }
  await supabase().from("leads").update({ status }).eq("id", leadId);
}

// ============ SETTINGS ============

export async function getSettings(): Promise<GymSettings> {
  if (isDemoMode) return state.settings;
  const { data, error } = await supabase().from("gyms").select("*").single();
  if (error) throw error;
  const g = data as Record<string, unknown>;
  return {
    name: (g.name as string) ?? "", address: (g.address as string) ?? "", phone: (g.phone as string) ?? "",
    email: (g.email as string) ?? "", hours: (g.hours as string) ?? "",
    cancellation_policy_hours: (g.cancellation_policy_hours as number) ?? 12,
  };
}

export async function saveSettings(s: GymSettings): Promise<void> {
  if (isDemoMode) {
    state.settings = { ...s };
    return;
  }
  await supabase().from("gyms").update(s).neq("id", "");
}
