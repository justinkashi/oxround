// Data layer. Uses Supabase when NEXT_PUBLIC_SUPABASE_URL is set; otherwise the
// in-memory demo dataset (mutations persist for the browser session — enough for the G1 demo).
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exec, newClientKey, withRetry } from "./resilience";
import type {
  Announcement, Attachment, BookingStatus, CheckIn, ClassBooking, ClassSession, CoachNote,
  GymClass, GymMember, GymSettings, GymTask, Lead, LeadStatus, MemberAttendanceSummary,
  Membership, MembershipPlan, Message, Payment, PaymentStatus, TaskStatus, TimelineEvent,
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

// The signed-in user's gym_id (from the JWT). Needed to stamp new rows with the tenant.
export async function getMyGymId(): Promise<string | null> {
  if (isDemoMode) return "g1";
  const { data: { session } } = await supabase().auth.getSession();
  const token = session?.access_token;
  if (!token) return null;
  try {
    const json = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return (json.gym_id as string) ?? null;
  } catch {
    return null;
  }
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
  // Twenty-transfer demo state (timeline is derived from check-ins/payments on read)
  notes: [] as CoachNote[],
  tasks: [] as GymTask[],
  attachments: [] as Attachment[],
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
  await exec(() => supabase().from("memberships").update({ payment_status: status }).eq("gym_member_id", memberId).eq("status", "active"));
}

export async function setMembershipPlan(memberId: string, planId: string | null): Promise<void> {
  if (isDemoMode) {
    const membership = state.memberships.find((x) => x.gym_member_id === memberId);
    if (membership) {
      const plan = planId ? state.plans.find((x) => x.id === planId) : null;
      membership.plan_name = plan?.name ?? "—";
    }
    return;
  }
  await exec(() => supabase().from("memberships").update({ plan_id: planId }).eq("gym_member_id", memberId).eq("status", "active"));
}

// A3 Interconnected: archive (soft-delete, D-03) — check-in function rejects non-active members.
export async function setMemberStatus(memberId: string, status: GymMember["status"]): Promise<void> {
  if (isDemoMode) {
    const m = state.members.find((x) => x.id === memberId);
    if (m) m.status = status;
    return;
  }
  await exec(() => supabase().from("gym_members").update({ status }).eq("id", memberId));
}

export type MemberProfileUpdate = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth?: string;
  joined_at?: string;
  weight_class?: string;
};

// Edit a member's profile fields (owner-only per RLS members_owner_update). Emails stored lowercased.
export async function updateMember(
  id: string,
  fields: MemberProfileUpdate,
): Promise<void> {
  const clean = {
    first_name: fields.first_name.trim(),
    last_name: fields.last_name?.trim() || null,
    email: fields.email?.trim().toLowerCase() || null,
    phone: fields.phone?.trim() || null,
  };
  if (!clean.first_name) throw new Error("First name is required.");
  const optional: Partial<Pick<GymMember, "date_of_birth" | "joined_at" | "weight_class">> = {};
  if ("date_of_birth" in fields) optional.date_of_birth = fields.date_of_birth?.trim() || null;
  if ("joined_at" in fields) optional.joined_at = fields.joined_at?.trim() || null;
  if ("weight_class" in fields) optional.weight_class = fields.weight_class?.trim() || null;
  if (isDemoMode) {
    const m = state.members.find((x) => x.id === id);
    if (m) Object.assign(m, clean, optional);
    return;
  }
  await exec(() => supabase().from("gym_members").update({ ...clean, ...optional }).eq("id", id));
}

export async function listArchivedMembers(): Promise<GymMember[]> {
  if (isDemoMode) return state.members.filter((m) => m.status === "archived");
  const { data, error } = await supabase().from("gym_members").select("*").eq("status", "archived").order("first_name");
  if (error) throw new Error(error.message);
  return data as GymMember[];
}

export type MemberWithMembership = { member: GymMember; membership: Membership | null };

// Header stats for the Members page: non-archived total + joined this month.
export type MemberStats = { total: number; newThisMonth: number };

export async function getMemberStats(): Promise<MemberStats> {
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString().slice(0, 10);
  if (isDemoMode) {
    const active = state.members.filter((m) => m.status !== "archived");
    return {
      total: active.length,
      newThisMonth: active.filter((m) => (m.joined_at ?? m.created_at ?? "") >= monthStartIso).length,
    };
  }
  const sb = supabase();
  const [all, recent] = await Promise.all([
    sb.from("gym_members").select("id", { count: "exact", head: true }).neq("status", "archived"),
    sb.from("gym_members").select("id", { count: "exact", head: true }).neq("status", "archived").gte("created_at", monthStartIso),
  ]);
  if (all.error) throw new Error(all.error.message);
  if (recent.error) throw new Error(recent.error.message);
  return { total: all.count ?? 0, newThisMonth: recent.count ?? 0 };
}

// Filter presets shown as chips on the Members page (Twenty "views", lite).
export type MemberFilter = "all" | "past_due" | "new_this_month";
export const MEMBERS_PAGE_SIZE = 50;

export type MembersPage = { rows: MemberWithMembership[]; total: number };

// One batched query — replaces the N+1 where each member's membership was fetched separately.
// VERSION 2: server-side pagination (max 50 rows/fetch), search + filter pushed to the DB.
export async function listMembersWithMemberships(
  opts: { page?: number; q?: string; filter?: MemberFilter } = {},
): Promise<MembersPage> {
  const page = opts.page ?? 0;
  const q = (opts.q ?? "").trim();
  const filter = opts.filter ?? "all";
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString().slice(0, 10);

  if (isDemoMode) {
    let rows = state.members
      .filter((m) => m.status !== "archived")
      .map((member) => ({ member, membership: state.memberships.find((s) => s.gym_member_id === member.id) ?? null }));
    if (q) rows = rows.filter(({ member: m }) => `${m.first_name} ${m.last_name ?? ""} ${m.email ?? ""}`.toLowerCase().includes(q.toLowerCase()));
    if (filter === "past_due") rows = rows.filter(({ membership: s }) => s?.payment_status === "overdue" || s?.payment_status === "pending");
    if (filter === "new_this_month") rows = rows.filter(({ member: m }) => (m.joined_at ?? m.created_at ?? "") >= monthStartIso);
    return { rows: rows.slice(page * MEMBERS_PAGE_SIZE, (page + 1) * MEMBERS_PAGE_SIZE), total: rows.length };
  }

  let query = supabase()
    .from("gym_members")
    .select("*, memberships(*, membership_plans(name))", { count: "exact" })
    .neq("status", "archived");
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    query = query.or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`);
  }
  if (filter === "past_due") {
    // inner join → only members whose active membership is overdue/pending
    query = supabase()
      .from("gym_members")
      .select("*, memberships!inner(*, membership_plans(name))", { count: "exact" })
      .neq("status", "archived")
      .eq("memberships.status", "active")
      .in("memberships.payment_status", ["overdue", "pending"]);
    if (q) {
      const like = `%${q.replace(/[%_]/g, "")}%`;
      query = query.or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`);
    }
  }
  if (filter === "new_this_month") query = query.gte("created_at", monthStartIso);
  const { data, error, count } = await query
    .order("first_name")
    .range(page * MEMBERS_PAGE_SIZE, (page + 1) * MEMBERS_PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  const rows = (data as Array<Record<string, unknown>>).map((row) => {
    const { memberships, ...rest } = row as Record<string, unknown> & { memberships?: Array<Record<string, unknown>> };
    const list = (memberships ?? []) as Array<Record<string, unknown> & { status?: string; membership_plans?: { name: string } }>;
    const active = list.find((s) => s.status === "active") ?? list[0] ?? null;
    const membership = active
      ? { ...(active as unknown as Membership), plan_name: active.membership_plans?.name ?? "—" }
      : null;
    return { member: rest as unknown as GymMember, membership };
  });
  return { rows, total: count ?? rows.length };
}

export async function createMember(
  input: { first_name: string; last_name: string; email: string; phone: string; role?: "member" | "coach" },
): Promise<GymMember> {
  const role = input.role ?? "member";
  // Only first_name is required; last_name/email/phone are optional → store null when blank.
  const fields = {
    first_name: input.first_name.trim(),
    last_name: input.last_name?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
  };
  if (isDemoMode) {
    if (fields.email && state.members.some((m) => m.status !== "archived" && m.email === fields.email)) {
      throw new Error("A member with that email already exists.");
    }
    const m: GymMember = {
      id: `m${Date.now()}`, gym_id: "g1", roles: [role], status: "active",
      joined_at: new Date().toISOString().slice(0, 10), emergency_contact: null,
      first_name: fields.first_name, last_name: fields.last_name || null,
      email: fields.email || null, phone: fields.phone || null,
    };
    state.members.push(m);
    if (role === "member") {
      state.memberships.push({ id: `s${Date.now()}`, gym_member_id: m.id, plan_name: "—", status: "active", payment_status: "pending", payment_method: null, start_date: m.joined_at!, next_billing_date: null });
    }
    return m;
  }
  const gymId = await getMyGymId();
  if (!gymId) throw new Error("Could not determine your gym. Log out and back in.");
  if (fields.email) {
    const { data: dupe } = await supabase().from("gym_members")
      .select("id").eq("gym_id", gymId).eq("email", fields.email).neq("status", "archived").maybeSingle();
    if (dupe) throw new Error("A member with that email already exists.");
  }
  // Real mode: raw token generated client-side ONCE for the QR; only SHA-256 stored (D-02).
  const raw = crypto.randomUUID() + crypto.randomUUID();
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const data = await exec(() => supabase()
    .from("gym_members")
    .insert({ ...fields, gym_id: gymId, roles: [role], check_in_token_hash: hash, client_key: newClientKey() })
    .select()
    .single());
  const member = data as GymMember;
  // D-24: a new MEMBER starts UNPAID — pending membership gates their QR (D-20) until first payment.
  // Coaches have no membership.
  if (role === "member") {
    await exec(() => supabase().from("memberships").insert({
      gym_id: gymId, gym_member_id: member.id, client_key: newClientKey(),
      status: "active", payment_status: "pending", start_date: new Date().toISOString().slice(0, 10),
    }));
  }
  (data as Record<string, unknown>).__raw_token = raw;
  return member;
}

export type BulkMemberInput = { first_name: string; last_name?: string; email?: string; phone?: string };
export type BulkImportResult = { created: number; errors: string[] };

// Bulk-create members from a spreadsheet import (CSV wizard). Mirrors createMember:
// each real member gets a SHA-256 check-in token hash + a pending membership (D-24/D-20).
// Invites are NOT auto-sent here — the import UI offers that as an opt-in.
export async function createMembersBulk(input: BulkMemberInput[]): Promise<BulkImportResult> {
  const rows = input
    .map((r) => ({
      first_name: (r.first_name ?? "").trim(),
      last_name: (r.last_name ?? "").trim(),
      email: (r.email ?? "").trim().toLowerCase(),
      phone: (r.phone ?? "").trim(),
    }))
    .filter((r) => r.first_name.length > 0);
  const result: BulkImportResult = { created: 0, errors: [] };
  if (rows.length === 0) return result;
  const today = new Date().toISOString().slice(0, 10);

  if (isDemoMode) {
    for (const r of rows) {
      const id = `m${Date.now()}${Math.floor(Math.random() * 1e4)}`;
      state.members.push({
        id, gym_id: "g1", roles: ["member"], status: "active", joined_at: today,
        emergency_contact: null, first_name: r.first_name, last_name: r.last_name || null,
        email: r.email || null, phone: r.phone || null,
      });
      state.memberships.push({
        id: `s${id}`, gym_member_id: id, plan_name: "—", status: "active",
        payment_status: "pending", payment_method: null, start_date: today, next_billing_date: null,
      });
      result.created++;
    }
    return result;
  }

  const gymId = await getMyGymId();
  if (!gymId) throw new Error("Could not determine your gym. Log out and back in.");
  const memberRows = await Promise.all(rows.map(async (r) => {
    const raw = crypto.randomUUID() + crypto.randomUUID();
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    const hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return {
      gym_id: gymId, roles: ["member"], check_in_token_hash: hash, client_key: newClientKey(),
      first_name: r.first_name, last_name: r.last_name || null,
      email: r.email || null, phone: r.phone || null,
    };
  }));
  const data = await exec(() => supabase().from("gym_members").insert(memberRows).select("id"));
  const ids = (data as { id: string }[]).map((d) => d.id);
  result.created = ids.length;
  if (ids.length) {
    const membershipRows = ids.map((id) => ({
      gym_id: gymId, gym_member_id: id, client_key: newClientKey(),
      status: "active", payment_status: "pending", start_date: today,
    }));
    const { error: mErr } = await supabase().from("memberships").insert(membershipRows);
    if (mErr) result.errors.push(`Members added, but their memberships didn't: ${mErr.message}`);
  }
  return result;
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
  await exec(() => supabase().from("check_ins").insert({ gym_id: m.gym_id, gym_member_id: memberId, method: "manual_staff" }));
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
  const res = await withRetry(() => supabase().from("check_ins").insert({ gym_id: m.gym_id, gym_member_id: memberId, method: "qr_phone" }));
  if (res.error) return { ok: false, name, reason: (res.error as { message?: string }).message ?? "Could not record the check-in" };
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
  const gymId = (await getCurrentMember())?.gym_id;
  const key = newClientKey();
  await exec(() => supabase().from("messages").insert({
    gym_id: gymId, sender_member_id: meId, client_key: key,
    recipient_member_id: input.recipient_member_id, body: input.body, is_broadcast: input.is_broadcast,
  }));
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
export async function inviteMemberEmail(email: string): Promise<{ ok: boolean; error?: string; note?: string }> {
  if (isDemoMode) return { ok: true };
  const { data, error } = await supabase().functions.invoke("invite-member", { body: { email } });
  if (error) {
    // supabase-js wraps a non-2xx as a generic message; the real reason is in the response body.
    let detail = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) detail = body.error as string;
      }
    } catch { /* keep the generic message */ }
    return { ok: false, error: detail };
  }
  if (data?.error) return { ok: false, error: data.error };
  // `note` = success but NOT the standard "invite sent" (e.g. already active — no email sent).
  // Surfacing it stops the UI claiming "sent" when nothing was emailed (2026-07-06 fix).
  return { ok: true, note: (data?.note as string) || undefined };
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
  const gymId = await getMyGymId();
  await exec(() => supabase().from("announcements").insert({ ...input, gym_id: gymId }));
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
  const gymId = await getMyGymId();
  await exec(() => supabase().from("membership_plans").insert({ ...input, gym_id: gymId }));
}

export async function setPlanActive(planId: string, isActive: boolean): Promise<void> {
  if (isDemoMode) {
    const p = state.plans.find((x) => x.id === planId);
    if (p) p.is_active = isActive;
    return;
  }
  await exec(() => supabase().from("membership_plans").update({ is_active: isActive }).eq("id", planId));
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
  const gymId = await getMyGymId();
  const data = await exec(() => supabase().from("classes").insert({ ...input, gym_id: gymId }).select().single());
  // Generate session instances for the next 4 weeks (prod has no cron yet — DEPLOY C1).
  // A weekly pg_cron job should extend this window going forward.
  const cl = data as GymClass;
  const rows: Array<Record<string, unknown>> = [];
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  for (let d = 0; d < 28; d++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + d);
    if (!cl.day_of_week.includes(day.getDay())) continue;
    rows.push({
      gym_id: gymId, class_id: cl.id, session_date: day.toISOString().slice(0, 10),
      start_time: cl.start_time, duration_mins: cl.duration_mins, capacity: cl.capacity,
      coach_id: cl.coach_id, status: "scheduled",
    });
  }
  if (rows.length) await exec(() => supabase().from("class_sessions").insert(rows));
}

export async function deactivateClass(classId: string): Promise<void> {
  if (isDemoMode) {
    const c = state.classes.find((x) => x.id === classId);
    if (c) c.is_active = false;
    state.sessions = state.sessions.filter((s) => s.class_id !== classId || s.session_date < new Date().toISOString().slice(0, 10));
    return;
  }
  await exec(() => supabase().from("classes").update({ is_active: false }).eq("id", classId));
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
  await exec(() => supabase().from("class_sessions").update({ status: "canceled" }).eq("id", sessionId));
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
  const gymId = await getMyGymId();
  await exec(() => supabase().from("class_bookings").insert({ gym_id: gymId, session_id: sessionId, gym_member_id: memberId, status }));
}

export async function setBookingStatus(bookingId: string, status: BookingStatus): Promise<void> {
  if (isDemoMode) {
    const b = state.bookings.find((x) => x.id === bookingId);
    if (b) b.status = status;
    return;
  }
  await exec(() => supabase().from("class_bookings").update({ status }).eq("id", bookingId));
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
  await exec(() => supabase().from("gym_members").update({ roles }).eq("id", memberId));
}

// ============ PAYMENTS ============

export async function listPayments(): Promise<Payment[]> {
  if (isDemoMode) return state.payments;
  const { data, error } = await supabase()
    .from("payments")
    .select("*, gym_members(first_name, last_name)")
    .order("paid_at", { ascending: false })
    .limit(200); // VERSION 2: never pull a whole table into the browser
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
  const gymId = await getMyGymId();
  const key = newClientKey();
  await exec(() => supabase().from("payments").insert({ ...input, gym_id: gymId, client_key: key }));
  await exec(() => supabase().from("memberships").update({ payment_status: "paid" }).eq("gym_member_id", input.gym_member_id).eq("status", "active"));
}

// ============ LEADS ============

export async function listLeads(): Promise<Lead[]> {
  if (isDemoMode) return state.leads;
  const { data, error } = await supabase().from("leads").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Lead[];
}

export async function createLead(input: { first_name: string; last_name: string; email: string; phone: string; source: Lead["source"]; notes: string; estimated_value_cents?: number | null }): Promise<void> {
  if (isDemoMode) {
    state.leads.unshift({
      id: `l${Date.now()}`, first_name: input.first_name, last_name: input.last_name || null,
      email: input.email || null, phone: input.phone || null, source: input.source,
      status: "new", follow_up_date: null, notes: input.notes || null, created_at: new Date().toISOString(),
      estimated_value_cents: input.estimated_value_cents ?? null,
    });
    return;
  }
  const gymId = await getMyGymId();
  const key = newClientKey();
  await exec(() => supabase().from("leads").insert({ ...input, gym_id: gymId, client_key: key }));
}

export async function setLeadStatus(leadId: string, status: LeadStatus): Promise<void> {
  if (isDemoMode) {
    const l = state.leads.find((x) => x.id === leadId);
    if (l) l.status = status;
    return;
  }
  await exec(() => supabase().from("leads").update({ status }).eq("id", leadId));
}

// ============ TIMELINE / NOTES / TASKS / ATTACHMENTS (Twenty transfer, 0010) ============

// Activity timeline for one member, newest first, max 50 per page.
export async function memberTimeline(memberId: string, page = 0): Promise<TimelineEvent[]> {
  if (isDemoMode) {
    // Derived on the fly from existing demo data so the timeline isn't empty.
    const events: TimelineEvent[] = [];
    for (const c of state.checkIns.filter((x) => x.gym_member_id === memberId)) {
      events.push({ id: `t-${c.id}`, gym_id: "g1", happens_at: c.checked_in_at, event_type: "check_in", title: "Checked in", properties: { method: c.method }, actor_member_id: null, target_member_id: memberId, target_lead_id: null });
    }
    for (const p of state.payments.filter((x) => x.gym_member_id === memberId)) {
      events.push({ id: `t-${p.id}`, gym_id: "g1", happens_at: p.paid_at, event_type: "payment", title: "Payment received", properties: { amount_cents: p.amount_cents, method: p.method }, actor_member_id: null, target_member_id: memberId, target_lead_id: null });
    }
    for (const n of state.notes.filter((x) => x.member_id === memberId)) {
      events.push({ id: `t-${n.id}`, gym_id: "g1", happens_at: n.created_at, event_type: "note_added", title: "Note added", properties: null, actor_member_id: n.author_id, target_member_id: memberId, target_lead_id: null });
    }
    return events.sort((a, b) => b.happens_at.localeCompare(a.happens_at)).slice(page * 50, (page + 1) * 50);
  }
  const { data, error } = await supabase()
    .from("timeline_events")
    .select("*")
    .eq("target_member_id", memberId)
    .order("happens_at", { ascending: false })
    .range(page * 50, (page + 1) * 50 - 1);
  if (error) throw new Error(error.message);
  return data as TimelineEvent[];
}

// Coach notes on a member (reuses the existing coach_notes table — no new notes table).
export async function listMemberNotes(memberId: string): Promise<CoachNote[]> {
  if (isDemoMode) return state.notes.filter((n) => n.member_id === memberId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { data, error } = await supabase()
    .from("coach_notes")
    .select("*, author:gym_members!coach_notes_author_id_fkey(first_name, last_name)")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data as Array<Record<string, unknown> & { author?: { first_name: string; last_name: string | null } | null }>).map((r) => ({
    id: r.id as string, member_id: r.member_id as string, author_id: (r.author_id as string | null) ?? null,
    author_name: r.author ? `${r.author.first_name} ${r.author.last_name ?? ""}`.trim() : "",
    body: r.body as string, visibility: r.visibility as CoachNote["visibility"], created_at: r.created_at as string,
  }));
}

export async function addMemberNote(memberId: string, body: string, visibility: CoachNote["visibility"] = "staff"): Promise<void> {
  const text = body.trim();
  if (!text) throw new Error("Note is empty.");
  if (isDemoMode) {
    state.notes.unshift({ id: `n${Date.now()}`, member_id: memberId, author_id: "m6", author_name: "You", body: text, visibility, created_at: new Date().toISOString() });
    return;
  }
  const gymId = await getMyGymId();
  const authorId = await currentMemberId();
  await exec(() => supabase().from("coach_notes").insert({ gym_id: gymId, member_id: memberId, author_id: authorId, body: text, visibility }));
}

// Tasks (Twenty Task): staff to-dos, optionally targeted at a member or lead.
export async function listTasks(target?: { memberId?: string; leadId?: string }): Promise<GymTask[]> {
  if (isDemoMode) {
    return state.tasks
      .filter((t) => (!target?.memberId || t.target_member_id === target.memberId) && (!target?.leadId || t.target_lead_id === target.leadId))
      .sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0) || (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"));
  }
  let q = supabase()
    .from("tasks")
    .select("*, assignee:gym_members!tasks_assignee_member_id_fkey(first_name, last_name)")
    .is("deleted_at", null)
    .order("status")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(50);
  if (target?.memberId) q = q.eq("target_member_id", target.memberId);
  if (target?.leadId) q = q.eq("target_lead_id", target.leadId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as Array<Record<string, unknown> & { assignee?: { first_name: string; last_name: string | null } | null }>).map((r) => ({
    id: r.id as string, gym_id: r.gym_id as string, title: r.title as string, body: (r.body as string | null) ?? null,
    due_at: (r.due_at as string | null) ?? null, status: r.status as TaskStatus,
    assignee_member_id: (r.assignee_member_id as string | null) ?? null,
    assignee_name: r.assignee ? `${r.assignee.first_name} ${r.assignee.last_name ?? ""}`.trim() : "",
    target_member_id: (r.target_member_id as string | null) ?? null,
    target_lead_id: (r.target_lead_id as string | null) ?? null,
    created_at: r.created_at as string,
  }));
}

export async function createTask(input: { title: string; due_at?: string | null; target_member_id?: string | null; target_lead_id?: string | null }): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error("Task needs a title.");
  if (isDemoMode) {
    state.tasks.unshift({
      id: `task${Date.now()}`, gym_id: "g1", title, body: null, due_at: input.due_at ?? null, status: "todo",
      assignee_member_id: null, target_member_id: input.target_member_id ?? null, target_lead_id: input.target_lead_id ?? null,
      created_at: new Date().toISOString(),
    });
    return;
  }
  const gymId = await getMyGymId();
  const creator = await currentMemberId();
  const key = newClientKey();
  await exec(() => supabase().from("tasks").insert({
    gym_id: gymId, title, due_at: input.due_at ?? null, created_by: creator, client_key: key,
    target_member_id: input.target_member_id ?? null, target_lead_id: input.target_lead_id ?? null,
  }));
}

export async function setTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  if (isDemoMode) {
    const t = state.tasks.find((x) => x.id === taskId);
    if (t) t.status = status;
    return;
  }
  await exec(() => supabase().from("tasks").update({ status }).eq("id", taskId));
}

// Attachments (Twenty Attachment): file metadata + private Storage object.
export async function listAttachments(memberId: string): Promise<Attachment[]> {
  if (isDemoMode) return state.attachments.filter((a) => a.target_member_id === memberId);
  const { data, error } = await supabase()
    .from("attachments")
    .select("*")
    .eq("target_member_id", memberId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data as Attachment[];
}

export async function uploadAttachment(memberId: string, file: File, category: Attachment["category"]): Promise<void> {
  if (isDemoMode) {
    state.attachments.unshift({
      id: `att${Date.now()}`, gym_id: "g1", name: file.name, storage_path: `demo/${file.name}`,
      mime_type: file.type || null, size_bytes: file.size, category,
      target_member_id: memberId, target_lead_id: null, created_at: new Date().toISOString(),
    });
    return;
  }
  const gymId = await getMyGymId();
  if (!gymId) throw new Error("Could not determine your gym.");
  const path = `${gymId}/${memberId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const { error: upErr } = await supabase().storage.from("attachments").upload(path, file);
  if (upErr) throw new Error(upErr.message);
  const author = await currentMemberId();
  const key = newClientKey();
  await exec(() => supabase().from("attachments").insert({
    gym_id: gymId, name: file.name, storage_path: path, mime_type: file.type || null,
    size_bytes: file.size, category, author_member_id: author, target_member_id: memberId, client_key: key,
  }));
}

export async function attachmentUrl(a: Attachment): Promise<string | null> {
  if (isDemoMode) return null;
  const { data } = await supabase().storage.from("attachments").createSignedUrl(a.storage_path, 60 * 10);
  return data?.signedUrl ?? null;
}

// Convert a won lead into a member in one step (kanban guardrail).
export async function convertLeadToMember(lead: Lead): Promise<GymMember> {
  const member = await createMember({
    first_name: lead.first_name, last_name: lead.last_name ?? "",
    email: lead.email ?? "", phone: lead.phone ?? "",
  });
  if (isDemoMode) {
    const l = state.leads.find((x) => x.id === lead.id);
    if (l) l.status = "converted";
    return member;
  }
  await exec(() => supabase().from("leads").update({ status: "converted", converted_member_id: member.id }).eq("id", lead.id));
  return member;
}

// Persist kanban drag ordering (Twenty position pattern).
export async function setLeadPosition(leadId: string, status: LeadStatus, position: number): Promise<void> {
  if (isDemoMode) {
    const l = state.leads.find((x) => x.id === leadId);
    if (l) l.status = status;
    return;
  }
  await exec(() => supabase().from("leads").update({ status, position }).eq("id", leadId));
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
  await exec(() => supabase().from("gyms").update(s).neq("id", ""));
}
