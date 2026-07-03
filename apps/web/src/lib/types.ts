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
