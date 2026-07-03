// In-memory demo dataset — used when NEXT_PUBLIC_SUPABASE_URL is not configured,
// so the CRM is showable to G1 before Supabase is provisioned.
// Mirrors supabase/seed.sql.

import type {
  Announcement, CheckIn, ClassBooking, ClassSession, GymClass, GymMember, GymSettings,
  Lead, Membership, MembershipPlan, Payment,
} from "./types";

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
  { id: "m6", gym_id: "g1", first_name: "Tony", last_name: "Bélanger", email: "tony@example.com", phone: "514-555-0106", roles: ["coach"], status: "active", joined_at: "2025-02-01", emergency_contact: null },
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

// ---- Phase-1 build-out demo data ----

export const demoPlans: MembershipPlan[] = [
  { id: "p1", gym_id: "g1", name: "Unlimited Monthly", kind: "recurring", price_cents: 12000, billing_period: "monthly", max_classes: null, is_active: true },
  { id: "p2", gym_id: "g1", name: "Annual (2 months free)", kind: "recurring", price_cents: 120000, billing_period: "annual", max_classes: null, is_active: true },
  { id: "p3", gym_id: "g1", name: "10-Class Punch Card", kind: "punch_card", price_cents: 15000, billing_period: null, max_classes: 10, is_active: true },
  { id: "p4", gym_id: "g1", name: "Drop-in", kind: "drop_in", price_cents: 2000, billing_period: null, max_classes: 1, is_active: true },
  { id: "p5", gym_id: "g1", name: "Family (2+)", kind: "family", price_cents: 20000, billing_period: "monthly", max_classes: null, is_active: true },
  { id: "p6", gym_id: "g1", name: "Free Trial Week", kind: "trial", price_cents: 0, billing_period: null, max_classes: 3, is_active: true },
];

export const demoClasses: GymClass[] = [
  { id: "cl1", gym_id: "g1", name: "Boxing Fundamentals", description: "Stance, jab, cross, footwork. All levels.", coach_id: "m4", day_of_week: [1, 3], start_time: "18:00", duration_mins: 60, capacity: 16, location: "Main floor", color: "red", is_active: true },
  { id: "cl2", gym_id: "g1", name: "Sparring (invite)", description: "Coach-approved members only. Full gear.", coach_id: "m6", day_of_week: [5], start_time: "19:00", duration_mins: 90, capacity: 10, location: "Ring", color: "purple", is_active: true },
  { id: "cl3", gym_id: "g1", name: "Conditioning", description: "Rope, bags, circuits.", coach_id: "m6", day_of_week: [2, 4], start_time: "07:00", duration_mins: 45, capacity: 20, location: "Main floor", color: "blue", is_active: true },
  { id: "cl4", gym_id: "g1", name: "Youth Boxing (8-14)", description: "Technique + games, no contact.", coach_id: "m4", day_of_week: [6], start_time: "10:00", duration_mins: 60, capacity: 12, location: "Main floor", color: "green", is_active: true },
  { id: "cl5", gym_id: "g1", name: "Open Gym", description: "Bags and ring open, coach on site.", coach_id: null, day_of_week: [0], start_time: "11:00", duration_mins: 120, capacity: null, location: "Whole gym", color: "yellow", is_active: true },
];

const coachName = (id: string | null) =>
  id ? (() => { const c = demoMembers.find((m) => m.id === id); return c ? `${c.first_name} ${c.last_name ?? ""}`.trim() : "—"; })() : "—";

// Generate this week's + next week's sessions from the class templates.
function genSessions(): ClassSession[] {
  const out: ClassSession[] = [];
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // this week's Monday
  let id = 0;
  for (let d = 0; d < 14; d++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + d);
    for (const cl of demoClasses) {
      if (!cl.day_of_week.includes(day.getDay())) continue;
      out.push({
        id: `ses${id++}`, class_id: cl.id, class_name: cl.name,
        session_date: day.toISOString().slice(0, 10),
        start_time: cl.start_time, duration_mins: cl.duration_mins, capacity: cl.capacity,
        coach_id: cl.coach_id, coach_name: coachName(cl.coach_id),
        status: "scheduled", color: cl.color,
      });
    }
  }
  return out.sort((a, b) => a.session_date.localeCompare(b.session_date) || a.start_time.localeCompare(b.start_time));
}
export const demoSessions: ClassSession[] = genSessions();

// Bookings on the next Boxing Fundamentals session: nearly full + a waitlist entry.
function genBookings(): ClassBooking[] {
  const todayISO = new Date().toISOString().slice(0, 10);
  const next = demoSessions.find((s) => s.class_id === "cl1" && s.session_date >= todayISO) ?? demoSessions[0];
  const past = demoSessions.find((s) => s.class_id === "cl3") ?? demoSessions[1];
  return [
    { id: "b1", session_id: next.id, gym_member_id: "m1", member_name: "Marco Silva", status: "booked", booked_at: daysAgo(1) },
    { id: "b2", session_id: next.id, gym_member_id: "m2", member_name: "Leila Tremblay", status: "booked", booked_at: daysAgo(1) },
    { id: "b3", session_id: next.id, gym_member_id: "m5", member_name: "Karim Haddad", status: "waitlisted", booked_at: daysAgo(0, 8) },
    { id: "b4", session_id: past.id, gym_member_id: "m1", member_name: "Marco Silva", status: "attended", booked_at: daysAgo(3) },
    { id: "b5", session_id: past.id, gym_member_id: "m3", member_name: "Dave Nguyen", status: "no_show", booked_at: daysAgo(3) },
  ];
}
export const demoBookings: ClassBooking[] = genBookings();

// ~4 months of payment history so the revenue report has a story.
function genPayments(): Payment[] {
  const out: Payment[] = [];
  let id = 0;
  const add = (memberId: string, name: string, cents: number, method: Payment["method"], d: number, notes: string | null = null) =>
    out.push({ id: `pay${id++}`, gym_member_id: memberId, member_name: name, amount_cents: cents, method, paid_at: daysAgo(d).slice(0, 10), notes });
  for (let month = 0; month < 4; month++) {
    add("m1", "Marco Silva", 12000, "etransfer", month * 30 + 2);
    add("m2", "Leila Tremblay", 12000, "cash", month * 30 + 6);
    if (month >= 1) add("m3", "Dave Nguyen", 12000, "etransfer", month * 30 + 9); // stopped paying — overdue story
  }
  add("m5", "Karim Haddad", 15000, "cash", 14, "10-class punch card");
  add("m5", "Karim Haddad", 2000, "cash", 95, "drop-in before joining");
  return out.sort((a, b) => b.paid_at.localeCompare(a.paid_at));
}
export const demoPayments: Payment[] = genPayments();

export const demoLeads: Lead[] = [
  { id: "l1", first_name: "Jess", last_name: "Morin", email: "jess@example.com", phone: "514-555-0201", source: "instagram", status: "new", follow_up_date: daysAgo(-1).slice(0, 10), notes: "DM'd about women's classes", created_at: daysAgo(1) },
  { id: "l2", first_name: "Omar", last_name: "Diallo", email: null, phone: "514-555-0202", source: "walk_in", status: "contacted", follow_up_date: daysAgo(-2).slice(0, 10), notes: "Came by Saturday, wants evening classes", created_at: daysAgo(4) },
  { id: "l3", first_name: "Priya", last_name: "Sharma", email: "priya@example.com", phone: null, source: "referral", status: "trial_scheduled", follow_up_date: daysAgo(-3).slice(0, 10), notes: "Friend of Leila — trial booked for Fundamentals", created_at: daysAgo(6) },
  { id: "l4", first_name: "Max", last_name: "Roy", email: "max@example.com", phone: "514-555-0204", source: "tiktok", status: "trialing", follow_up_date: null, notes: "2 of 3 trial classes used", created_at: daysAgo(12) },
  { id: "l5", first_name: "Chloé", last_name: "Dubé", email: "chloe@example.com", phone: null, source: "fight_event", status: "converted", follow_up_date: null, notes: "Signed up after Golden Gloves night", created_at: daysAgo(30) },
  { id: "l6", first_name: "Sam", last_name: "Kim", email: null, phone: "514-555-0206", source: "website", status: "lost", follow_up_date: null, notes: "Moved to Laval", created_at: daysAgo(40) },
];

export const demoSettings: GymSettings = {
  name: "G1 Boxing",
  address: "123 Rue Principale, Vaudreuil-Dorion, QC",
  phone: "450-555-0100",
  email: "info@g1boxing.ca",
  hours: "Mon-Fri 6:30-21:00 · Sat 9:00-14:00 · Sun 11:00-13:00",
  cancellation_policy_hours: 12,
};

export const demoAnnouncements: Announcement[] = [
  { id: "a1", title: "Marco fights Aug 15! 🥊", body: "Come support Marco at the Montreal Golden Gloves. Tickets at the front desk.", type: "fight", pinned: true, published_at: daysAgo(2), read_count: 42, reaction_count: 18, media_urls: [] },
  { id: "a2", title: "Gym closed July 1", body: "Closed for Canada Day. Regular schedule resumes July 2.", type: "closure", pinned: false, published_at: daysAgo(4), read_count: 61, reaction_count: 5, media_urls: [] },
];
