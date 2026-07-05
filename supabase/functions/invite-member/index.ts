// invite-member Edge Function (Step 6G / D-24).
// Owner/staff calls this after creating a member → emails an activation link (via Resend SMTP)
// and links the new auth user to the existing gym_members row by email.
// Only staff of the caller's gym may invite. Uses the service-role key (server-side only).

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
    const { email } = await req.json();
    if (!email) return json({ error: "email required" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is authenticated staff (using their JWT).
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "not authenticated" }, 401);

    const admin = createClient(url, serviceKey);
    const { data: caller } = await admin.from("gym_members").select("roles, gym_id").eq("user_id", user.id).maybeSingle();
    const staffRoles = ["owner", "manager", "coach", "receptionist"];
    if (!caller || !(caller.roles as string[]).some((r) => staffRoles.includes(r))) {
      return json({ error: "not authorized" }, 403);
    }

    // The member row must already exist in the caller's gym (created by the owner).
    const { data: member } = await admin
      .from("gym_members")
      .select("id, user_id, gym_id")
      .eq("email", email)
      .eq("gym_id", caller.gym_id)
      .maybeSingle();
    if (!member) return json({ error: "no member with that email in your gym" }, 404);

    const appUrl = Deno.env.get("APP_URL");
    const redirectTo = appUrl ? `${appUrl}/auth/confirm` : undefined;
    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error) return json({ error: error.message }, 400);

    if (invited?.user?.id && !member.user_id) {
      await admin.from("gym_members").update({ user_id: invited.user.id }).eq("id", member.id);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
