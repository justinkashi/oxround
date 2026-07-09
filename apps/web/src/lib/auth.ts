// Single source of truth for auth role routing.
// Every place that decides "where does this user belong after login" — the confirm
// server action, the client magic-link callback, and the proxy route guard — imports
// resolveHome() from here so the mapping can never drift between them.

export const STAFF_ROLES = ["owner", "manager", "coach", "receptionist"];

// Decode roles[] from an access-token JWT payload. The token is assumed already
// validated (via getUser/verifyOtp); we only read a claim, not trust it for auth.
export function rolesFromToken(token: string | undefined): string[] {
  if (!token) return [];
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(payload));
    return Array.isArray(json.roles) ? json.roles : [];
  } catch {
    return [];
  }
}

// The one function that maps roles → landing page.
//   staff (any staff role)      → CRM home
//   member (and not staff)      → member app
//   no usable role              → explain, don't loop
// Staff who are also members are treated as staff (CRM), matching the proxy guard.
export function resolveHome(roles: string[]): string {
  if (roles.some((r) => STAFF_ROLES.includes(r))) return "/";
  if (roles.includes("member")) return "/app";
  return "/no-access";
}
