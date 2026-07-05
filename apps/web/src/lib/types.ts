// Shared domain types (mirror of supabase/migrations/00000000000001_initial_schema.sql)

export type Role = "owner" | "manager" | "coach" | "receptionist" | "member" | "trial";
export type MemberStatus = "active" | "inactive" | "suspended" | "archived";
export type PaymentStatus = "paid" | "pending" | "overdue" | "comped";
export type AnnouncementType = "general" | "schedule_change" | "event" | "fight" | "closure";

export interface GymMember {
  id: string;
  gym_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  roles: Role[];
  status: MemberStatus;
  joined_at: string | null;
  emergency_contact: { name: string; phone: string; relation: string } | null;
}

export interface Membership {
  id: string;
  gym_member_id: string;
  plan_name: string;
  status: "active" | "paused" | "expired" | "canceled";
  payment_status: PaymentStatus;
  payment_method: "cash" | "etransfer" | "card" | null;
  start_date: string;
  next_billing_date: string | null;
}

export interface CheckIn {
  id: string;
  gym_member_id: string;
  member_name: string;
  method: "qr_kiosk" | "qr_phone" | "manual_staff" | "manual_import";
  checked_in_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string | null;
  type: AnnouncementType;
  pinned: boolean;
  published_at: string;
  read_count: number;
  reaction_count: number;
  media_urls: string[];
}

export interface MemberAttendanceSummary {
  member: GymMember;
  visitsLast30: number;
  visitsPrev30: number;
  streakWeeks: number;
  totalVisits: number;
  lastVisit: string | null;
}

// ---- Phase-1 build-out types (mirror schema tables) ----

export type PlanKind = "recurring" | "drop_in" | "punch_card" | "family" | "trial" | "intro_offer";

export interface MembershipPlan {
  id: string;
  gym_id: string;
  name: string;
  kind: PlanKind;
  price_cents: number | null;
  billing_period: "monthly" | "quarterly" | "annual" | null;
  max_classes: number | null;
  is_active: boolean;
}

export interface GymClass {
  id: string;
  gym_id: string;
  name: string;
  description: string | null;
  coach_id: string | null;
  day_of_week: number[]; // 0=Sun … 6=Sat
  start_time: string; // "18:00"
  duration_mins: number;
  capacity: number | null;
  location: string | null;
  color: string | null; // badge color key: "red" | "blue" | "green" | "yellow" | "purple"
  is_active: boolean;
}

export type SessionStatus = "scheduled" | "canceled" | "completed";

export interface ClassSession {
  id: string;
  class_id: string;
  class_name: string;
  session_date: string; // "2026-07-03"
  start_time: string;
  duration_mins: number;
  capacity: number | null;
  coach_id: string | null;
  coach_name: string;
  status: SessionStatus;
  color: string | null;
}

export type BookingStatus = "booked" | "canceled" | "waitlisted" | "attended" | "no_show";

export interface ClassBooking {
  id: string;
  session_id: string;
  gym_member_id: string;
  member_name: string;
  status: BookingStatus;
  booked_at: string;
}

export interface Payment {
  id: string;
  gym_member_id: string;
  member_name: string;
  amount_cents: number;
  method: "cash" | "etransfer" | "card" | "other";
  paid_at: string; // date
  notes: string | null;
}

export type LeadSource = "walk_in" | "referral" | "instagram" | "tiktok" | "facebook" | "youtube" | "website" | "fight_event" | "other";
export type LeadStatus = "new" | "contacted" | "trial_scheduled" | "trialing" | "converted" | "lost";

export interface Lead {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource | null;
  status: LeadStatus;
  follow_up_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  sender_member_id: string;
  sender_name: string;
  recipient_member_id: string | null;
  body: string;
  is_broadcast: boolean;
  created_at: string;
  read_at: string | null;
}

export interface GymSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  cancellation_policy_hours: number;
}
