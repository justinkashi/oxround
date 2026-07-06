// invite-member Edge Function (Step 6G / D-24).
// Owner/staff calls this after creating a member → emails an activation link (via Resend SMTP)
// and links the new auth user to the existing gym_members row by email.
//
// Auth model: this function AUTHENTICATES ITS OWN CALLER (getUser + staff-role check),
// so it is deployed with verify_jwt = FALSE. Leaving the gateway verify_jwt gate ON caused
// silent 401s before the body ran (no logs, no email) — that was the "non-2xx" bug.

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { email } = await req.json().catch(() => ({}));
    if (!email) return json({ error: "email required" }, 400);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceKey || !anonKey) {
      console.error("invite-member: missing env", { url: !!url, serviceKey: !!serviceKey, anonKey: !!anonKey });
      return json({ error: "server misconfigured (missing keys)" }, 500);
    }

    // Verify the caller is authenticated staff (self-auth; gateway verify_jwt is off).
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "sign in again and retry" }, 401);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "sign in again and retry" }, 401);

    const admin = createClient(url, serviceKey);
    const { data: caller } = await admin.from("gym_members").select("roles, gym_id").eq("user_id", user.id).maybeSingle();
    const staffRoles = ["owner", "manager", "coach", "receptionist"];
    if (!caller || !(caller.roles as string[]).some((r) => staffRoles.includes(r))) {
      return json({ error: "only staff can send invites" }, 403);
    }

    // The member row must already exist in the caller's gym (created by the owner).
    const { data: member } = await admin
      .from("gym_members")
      .select("id, user_id, gym_id")
      .eq("email", email)
      .eq("gym_id", caller.gym_id)
      .maybeSingle();
    if (!member) return json({ error: "add the member first — no member with that email in your gym" }, 404);

    const appUrl = Deno.env.get("APP_URL");
    const redirectTo = appUrl ? `${appUrl}/auth/confirm` : undefined;

    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error) {
      // If the person already has an account, link it instead of failing.
      const already = /already|registered|exists|taken/i.test(error.message);
      if (already) {
        const { data: list } = await admin.auth.admin.listUsers();
        const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === String(email).toLowerCase());
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
