// check-in Edge Function
// D-02: SHA-256 token validation (NOT bcrypt). D-01: called by kiosk with gym-scoped JWT.
// Validates raw token -> active member -> 1h duplicate window -> inserts check_in.
// README (MAINTENANCE.md requirement): inputs/outputs/failure modes documented below.
//
// POST /functions/v1/check-in
//   headers: Authorization: Bearer <kiosk-or-staff JWT>
//   body: { token: string, device_id?: string, method?: "qr_kiosk" | "qr_phone" }
// returns 200 { success: true, member_name, membership_status }
//         4xx { success: false, code: "invalid_token"|"inactive"|"duplicate"|"rate_limited" }

import { createClient } from "jsr:@supabase/supabase-js@2";

const RATE_LIMIT = 10; // attempts/min/device — critique §11: brute-force protection
const attempts = new Map<string, { count: number; reset: number }>();

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ success: false, code: "method_not_allowed" }, 405);

  const { token, device_id = "unknown", method = "qr_kiosk" } = await req.json().catch(() => ({}));
  if (!token || typeof token !== "string") return json({ success: false, code: "invalid_token" }, 400);

  // rate limit per device
  const now = Date.now();
  const rl = attempts.get(device_id) ?? { count: 0, reset: now + 60_000 };
  if (now > rl.reset) { rl.count = 0; rl.reset = now + 60_000; }
  rl.count++;
  attempts.set(device_id, rl);
  if (rl.count > RATE_LIMIT) return json({ success: false, code: "rate_limited" }, 429);

  // caller's JWT determines gym scope; service client used only server-side for lookups
  const authHeader = req.headers.get("Authorization") ?? "";
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // never leaves this server
  );

  // verify caller and extract gym_id claim
  const jwt = authHeader.replace("Bearer ", "");
  const payload = JSON.parse(atob(jwt.split(".")[1] ?? "") || "{}");
  const gymId = payload.gym_id;
  if (!gymId || !(payload.kiosk === true || (payload.roles ?? []).some((r: string) =>
    ["owner", "manager", "coach", "receptionist"].includes(r)))) {
    return json({ success: false, code: "unauthorized" }, 401);
  }

  const tokenHash = await sha256Hex(token);
  const { data: member } = await admin
    .from("gym_members")
    .select("id, first_name, last_name, status, gym_id")
    .eq("gym_id", gymId)
    .eq("check_in_token_hash", tokenHash)
    .maybeSingle();

  if (!member) return json({ success: false, code: "invalid_token" }, 404);

  // A3 Interconnected: deactivated member's QR must fail here
  if (member.status !== "active") {
    return json({ success: false, code: "inactive", member_name: member.first_name }, 403);
  }

  const { data: membership } = await admin
    .from("memberships")
    .select("status, payment_status")
    .eq("gym_member_id", member.id)
    .eq("status", "active")
    .maybeSingle();

  // duplicate scan within 1h window
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin
    .from("check_ins")
    .select("id", { count: "exact", head: true })
    .eq("gym_member_id", member.id)
    .gte("checked_in_at", oneHourAgo);
  if ((count ?? 0) > 0) {
    return json({ success: false, code: "duplicate", member_name: member.first_name }, 409);
  }

  const { error } = await admin.from("check_ins").insert({
    gym_id: gymId,
    gym_member_id: member.id,
    method,
    device_id,
  });
  if (error) return json({ success: false, code: "db_error" }, 500);

  return json({
    success: true,
    member_name: `${member.first_name} ${member.last_name ?? ""}`.trim(),
    membership_status: membership?.payment_status ?? "none",
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
