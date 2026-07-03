// Data layer. Uses Supabase when NEXT_PUBLIC_SUPABASE_URL is set; otherwise the
// in-memory demo dataset (mutations persist for the browser session — enough for the G1 demo).
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Announcement, CheckIn, GymMember, MemberAttendanceSummary, Membership, PaymentStatus } from "./types";
import { demoAnnouncements, demoCheckIns, demoMembers, demoMemberships } from "./demo-data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const isDemoMode = !url || !anon;

let sb: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!sb) sb = createClient(url!, anon!);
  return sb;
}

// ---- session-mutable demo state ----
const state = {
  members: [...demoMembers],
  memberships: [...demoMemberships],
  checkIns: [...demoCheckIns],
  announcements: [...demoAnnouncements],
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
  // Caller is responsible for showing/printing `raw` immediately — it is not retrievable later.
  (data as Record<string, unknown>).__raw_token = raw;
  return data as GymMember;
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
