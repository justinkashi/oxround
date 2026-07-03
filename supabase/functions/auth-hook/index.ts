// auth-hook Edge Function (Supabase Custom Access Token hook)
// Injects gym_id + roles[] into the JWT from gym_members at token issue time.
// D-06: roles is an array (coach can also be member).
// D-09 (deferred): single gym per session; multi-gym coach re-issues JWT on gym switch.

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const { user_id, claims } = await req.json();

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: gm } = await admin
    .from("gym_members")
    .select("gym_id, roles")
    .eq("user_id", user_id)
    .neq("status", "archived")
    .limit(1)
    .maybeSingle();

  return new Response(
    JSON.stringify({
      claims: {
        ...claims,
        gym_id: gm?.gym_id ?? null,
        roles: gm?.roles ?? [],
      },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
