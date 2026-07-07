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

// Update a gym_members row (user_id link and/or invite_status). Returns an error message,
// or null on success. Every such write goes through here (or is error-checked inline) so a
// failed link surfaces as a real error instead of a silent "invite sent" that dead-ends.
async function markMember(
  admin: ReturnType<typeof createClient>,
  memberId: string,
  fields: Record<string, unknown>,
): Promise<string | null> {
  const { error } = await admin.from("gym_members").update(fields).eq("id", memberId);
  return error?.message ?? null;
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
      // inviteUserByEmail only emails BRAND-NEW addresses; an existing auth user → 422
      // "already been registered" and no email. Two sub-cases (2026-07-06 fix):
      //   1. Activated (signed in / confirmed at least once) → nothing to send; link + say so.
      //   2. Invited but never activated → the ONLY way GoTrue re-sends an invite email is a
      //      fresh inviteUserByEmail, so delete the stale pending auth user and re-invite.
      //      Safe: a never-activated user owns no data (profiles cascade-deletes; gym_members
      //      refs are nulled first because that FK is NO ACTION, then relinked to the new user).
      const already = /already|registered|exists|taken/i.test(error.message);
      if (already) {
        const { data: list } = await admin.auth.admin.listUsers();
        const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
        if (!existing) {
          console.error("invite-member: 'already registered' but user not found:", error.message);
          return json({ error: `email provider error: ${error.message}` }, 502);
        }
        const activated = !!existing.last_sign_in_at || !!existing.email_confirmed_at;
        if (activated) {
          const fields = member.user_id
            ? { invite_status: "active" }
            : { user_id: existing.id, invite_status: "active" };
          const linkErr = await markMember(admin, member.id, fields);
          if (linkErr) {
            console.error("invite-member: mark active failed:", linkErr);
            return json({ error: `couldn't link their existing account: ${linkErr}` }, 500);
          }
          return json({ ok: true, note: "no email sent — they already have an active account and can just log in" });
        }
        // Null the stale pending user's link before deleting it (FK is NO ACTION, so an
        // unchecked failure here would make the deleteUser below fail confusingly).
        const { error: unlinkErr } = await admin.from("gym_members").update({ user_id: null }).eq("user_id", existing.id);
        if (unlinkErr) {
          console.error("invite-member: couldn't unlink stale pending user:", unlinkErr.message);
          return json({ error: `couldn't refresh the pending invite: ${unlinkErr.message}` }, 500);
        }
        const { error: delErr } = await admin.auth.admin.deleteUser(existing.id);
        if (delErr) {
          console.error("invite-member: couldn't remove stale pending user:", delErr.message);
          return json({ error: `couldn't refresh the pending invite: ${delErr.message}` }, 500);
        }
        const { data: reinvited, error: reErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
        if (reErr) {
          console.error("invite-member: re-invite failed:", reErr.message);
          return json({ error: `email provider error: ${reErr.message}` }, 502);
        }
        if (reinvited?.user?.id) {
          const linkErr = await markMember(admin, member.id, { user_id: reinvited.user.id, invite_status: "invited" });
          if (linkErr) {
            console.error("invite-member: link after re-invite failed:", linkErr);
            return json({ error: `invite emailed but linking the account failed — retry: ${linkErr}` }, 500);
          }
        }
        return json({ ok: true, note: "fresh invite emailed (their old link is now void)" });
      }
      console.error("invite-member: inviteUserByEmail failed:", error.message);
      return json({ error: `email provider error: ${error.message}` }, 502);
    }

    if (invited?.user?.id) {
      const fields = member.user_id
        ? { invite_status: "invited" }
        : { user_id: invited.user.id, invite_status: "invited" };
      const linkErr = await markMember(admin, member.id, fields);
      if (linkErr) {
        console.error("invite-member: link after invite failed:", linkErr);
        return json({ error: `invite emailed but linking the account failed — retry: ${linkErr}` }, 500);
      }
    }
    return json({ ok: true });
  } catch (e) {
    console.error("invite-member: crashed:", String(e));
    return json({ error: String(e) }, 500);
  }
});
