// invite-member Edge Function (Step 6G / D-24).
// Owner/staff calls this after creating a member → emails an activation link (via Resend SMTP)
// and links the new auth user to the existing gym_members row by email.
//
// Auth model: self-authenticating, deployed with verify_jwt = FALSE.
//   1. Validate the caller's token with getUser(token) — proves it's a genuine, unexpired user.
//   2. Read roles + gym_id from the token's claims (the custom access token hook injects them).
//      This avoids a fragile service-role lookup that was returning empty and 403-ing owners.
//      Falls back to a DB lookup only if the token predates the hook.

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function claimsFromToken(token: string): { roles: string[]; gymId: string | null } {
  try {
    const p = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { roles: Array.isArray(p.roles) ? p.roles : [], gymId: (p.gym_id as string) ?? null };
  } catch {
    return { roles: [], gymId: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!email) return json({ error: "email required" }, 400);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceKey || !anonKey) {
      console.error("invite-member: missing env", { url: !!url, serviceKey: !!serviceKey, anonKey: !!anonKey });
      return json({ error: "server misconfigured (missing keys)" }, 500);
    }

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "sign in again and retry" }, 401);

    // Validate the token (genuine, unexpired user).
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !user) return json({ error: "sign in again and retry" }, 401);

    const admin = createClient(url, serviceKey);

    // Staff check from the signed token's claims; DB fallback only if claims are absent.
    let { roles, gymId } = claimsFromToken(token);
    if (!roles.length || !gymId) {
      const { data: caller } = await admin.from("gym_members").select("roles, gym_id").eq("user_id", user.id).maybeSingle();
      if (caller) {
        if (!roles.length) roles = (caller.roles as string[]) ?? [];
        if (!gymId) gymId = (caller.gym_id as string) ?? null;
      }
    }

    const staffRoles = ["owner", "manager", "coach", "receptionist"];
    if (!roles.some((r) => staffRoles.includes(r))) return json({ error: "only staff can send invites" }, 403);
    if (!gymId) return json({ error: "your account isn't linked to a gym — sign out and back in" }, 400);

    // The member row must already exist in the caller's gym (created by the owner). Emails are stored lowercased.
    // Ignore archived rows and take the newest match: an email can legitimately appear on
    // archived duplicates (add → archive → re-add). maybeSingle() alone errors on >1 row,
    // which made invites fail with "no member with that email" — 2026-07-06 fix.
    const { data: member, error: lookupErr } = await admin
      .from("gym_members")
      .select("id, user_id, gym_id")
      .eq("email", email)
      .eq("gym_id", gymId)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lookupErr) {
      console.error("invite-member: member lookup failed:", lookupErr.message);
      return json({ error: `member lookup failed: ${lookupErr.message}` }, 500);
    }
    if (!member) return json({ error: "add the member first — no member with that email in your gym" }, 404);

    const appUrl = Deno.env.get("APP_URL");
    const redirectTo = appUrl ? `${appUrl}/auth/confirm` : undefined;

    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error) {
      // If the person already has an account, link it instead of failing.
      const already = /already|registered|exists|taken/i.test(error.message);
      if (already) {
        const { data: list } = await admin.auth.admin.listUsers();
        const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
        if (existing && !member.user_id) {
          await admin.from("gym_members").update({ user_id: existing.id }).eq("id", member.id);
        }
        return json({ ok: true, note: "already had an account — linked (no new email)" });
      }
      console.error("invite-member: inviteUserByEmail failed:", error.message);
      return json({ error: `email provider error: ${error.message}` }, 502);
    }

    if (invited?.user?.id && !member.user_id) {
      await admin.from("gym_members").update({ user_id: invited.user.id }).eq("id", member.id);
    }
    return json({ ok: true });
  } catch (e) {
    console.error("invite-member: crashed:", String(e));
    return json({ error: String(e) }, 500);
  }
});
