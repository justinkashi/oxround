// In-memory demo dataset — used when NEXT_PUBLIC_SUPABASE_URL is not configured,
// so the CRM is showable to G1 before Supabase is provisioned.
// Mirrors supabase/seed.sql.

import type { Announcement, CheckIn, GymMember, Membership } from "./types";

const daysAgo = (d: number, h = 9) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
};

export const demoMembers: GymMember[] = [
  { id: "m1", gym_id: "g1", first_name: "Marco", last_name: "Silva", email: "marco@example.com", phone: "514-555-0101", roles: ["member"], status: "active", joined_at: "2025-09-01", emergency_contact: { name: "Ana Silva", phone: "514-555-0111", relation: "spouse" } },
  { id: "m2", gym_id: "g1", first_name: "Leila", last_name: "Tremblay", email: "leila@example.com", phone: "514-555-0102", roles: ["member"], status: "active", joined_at: "2025-11-15", emergency_contact: null },
  { id: "m3", gym_id: "g1", first_name: "Dave", last_name: "Nguyen", email: "dave@example.com", phone: "514-555-0103", roles: ["member"], status: "active", joined_at: "2026-01-10", emergency_contact: null },
  { id: "m4", gym_id: "g1", first_name: "Sophie", last_name: "Gagnon", email: "sophie@example.com", phone: "514-555-0104", roles: ["coach", "member"], status: "active", joined_at: "2024-06-01", emergency_contact: null },
  { id: "m5", gym_id: "g1", first_name: "Karim", last_name: "Haddad", email: "karim@example.com", phone: "514-555-0105", roles: ["member"], status: "active", joined_at: "2026-03-20", emergency_contact: null },
];

export const demoMemberships: Membership[] = [
  { id: "s1", gym_member_id: "m1", plan_name: "Unlimited Monthly", status: "active", payment_status: "paid", payment_method: "etransfer", start_date: "2025-09-01", next_billing_date: daysAgo(-14).slice(0, 10) },
  { id: "s2", gym_member_id: "m2", plan_name: "Unlimited Monthly", status: "active", payment_status: "paid", payment_method: "cash", start_date: "2025-11-15", next_billing_date: daysAgo(-10).slice(0, 10) },
  { id: "s3", gym_member_id: "m3", plan_name: "Unlimited Monthly", status: "active", payment_status: "overdue", payment_method: "etransfer", start_date: "2026-01-10", next_billing_date: daysAgo(6).slice(0, 10) },
  { id: "s4", gym_member_id: "m4", plan_name: "Staff", status: "active", payment_status: "comped", payment_method: null, start_date: "2024-06-01", next_billing_date: null },
  { id: "s5", gym_member_id: "m5", plan_name: "10-Class Punch Card", status: "active", payment_status: "pending", payment_method: "cash", start_date: "2026-03-20", next_billing_date: daysAgo(-2).slice(0, 10) },
];

// Attendance patterns: Marco 3x/wk, Leila 2x/wk, Dave dropped off 25 days ago (at-risk),
// Karim only recently active. Powers the "user-loss in numbers" demo (logs.md July 2).
function genCheckIns(): CheckIn[] {
  const out: CheckIn[] = [];
  let id = 0;
  const add = (memberId: string, name: string, d: number, h: number) =>
    out.push({ id: `c${id++}`, gym_member_id: memberId, member_name: name, method: "qr_kiosk", checked_in_at: daysAgo(d, h) });
  for (let d = 0; d <= 60; d++) {
    if (d % 2 === 0) add("m1", "Marco Silva", d, 7);
    if (d % 3 === 0) add("m2", "Leila Tremblay", d, 18);
    if (d > 25 && d % 2 === 0) add("m3", "Dave Nguyen", d, 19);
    if (d < 12 && d % 3 === 0) add("m5", "Karim Haddad", d, 17);
  }
  return out.sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at));
}
export const demoCheckIns: CheckIn[] = genCheckIns();

export const demoAnnouncements: Announcement[] = [
  { id: "a1", title: "Marco fights Aug 15! 🥊", body: "Come support Marco at the Montreal Golden Gloves. Tickets at the front desk.", type: "fight", pinned: true, published_at: daysAgo(2), read_count: 42, reaction_count: 18, media_urls: [] },
  { id: "a2", title: "Gym closed July 1", body: "Closed for Canada Day. Regular schedule resumes July 2.", type: "closure", pinned: false, published_at: daysAgo(4), read_count: 61, reaction_count: 5, media_urls: [] },
];
