"use client";
// Responsive nav: desktop = fixed sidebar (unchanged look); mobile = top bar + hamburger.
// Real mode: shows the signed-in email + logout. Demo mode: shows nothing extra.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMyRoles, getOwnerNotifications, isDemoMode, supabase, type OwnerNotification } from "@/lib/data";

// `roles` = who can see the tab. Empty = everyone (staff). D-21 permissions matrix.
const nav: { href: string; label: string; roles?: string[] }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/members", label: "Members" },
  { href: "/classes", label: "Classes" },
  { href: "/scanner", label: "Scan check-in" },
  { href: "/attendance", label: "Attendance", roles: ["owner", "manager"] },
  { href: "/payments", label: "Payments", roles: ["owner", "manager", "receptionist"] },
  { href: "/plans", label: "Plans", roles: ["owner", "manager"] },
  { href: "/leads", label: "Leads", roles: ["owner", "manager", "receptionist"] },
  { href: "/coaches", label: "Coaches", roles: ["owner", "manager"] },
  { href: "/announcements", label: "Announcements" },
  { href: "/reports", label: "Reports", roles: ["owner", "manager"] },
  { href: "/settings", label: "Settings", roles: ["owner", "manager"] },
];

const extras = [
  { href: "/app", label: "📱 Member app preview" },
];

function visibleNav(roles: string[]) {
  // Demo mode (roles=[owner]) sees everything. Staff see tabs allowed for their role.
  return nav.filter((n) => !n.roles || n.roles.some((r) => roles.includes(r)));
}

function NavLinks({ roles, onNavigate }: { roles: string[]; onNavigate?: () => void }) {
  return (
    <>
      <nav className="space-y-1">
        {visibleNav(roles).map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className="block rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-red-50 hover:text-brand"
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="mt-8 space-y-1 border-t border-neutral-200 pt-4">
        {extras.map((n) => (
          <Link key={n.href} href={n.href} onClick={onNavigate} className="block rounded-md px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-50">
            {n.label}
          </Link>
        ))}
      </div>
    </>
  );
}

function NotificationBell() {
  const [items, setItems] = useState<OwnerNotification[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { getOwnerNotifications().then(setItems).catch(() => {}); }, []);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Notifications" className="relative rounded-md px-2 py-1 text-lg hover:bg-neutral-100">
        🔔
        {items.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{items.length}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-72 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
          <div className="px-2 py-1 text-xs font-semibold uppercase text-neutral-400">Alerts</div>
          {items.length === 0 && <div className="px-2 py-3 text-center text-xs text-neutral-400">All clear 🎉</div>}
          {items.map((n) => (
            <Link key={n.id} href={n.href} onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-2 text-xs hover:bg-neutral-50">
              <span className="mr-1">{n.kind === "overdue" ? "💳" : "⚠️"}</span>{n.text}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2">
      <span className="text-xl">🥊</span>
      <div>
        <div className="font-bold tracking-tight">OxRound</div>
        <div className="text-xs text-neutral-500">G1 Boxing</div>
      </div>
    </div>
  );
}

function UserBox() {
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (isDemoMode) return;
    supabase().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  if (isDemoMode || !email) return null;
  return (
    <div className="mt-6 border-t border-neutral-200 pt-3">
      <div className="truncate px-3 text-xs text-neutral-500" title={email}>{email}</div>
      <button
        onClick={async () => {
          await supabase().auth.signOut();
          router.push("/login");
          router.refresh();
        }}
        className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-red-50 hover:text-brand"
      >
        Log out
      </button>
    </div>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => { getMyRoles().then(setRoles); }, []);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-neutral-200 bg-white p-4 md:block">
        <div className="mb-8 flex items-center justify-between"><Brand /><NotificationBell /></div>
        <NavLinks roles={roles} />
        <UserBox />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 border-b border-neutral-200 bg-white md:hidden">
        <div className="flex items-center justify-between p-3">
          <Brand />
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={() => setOpen(!open)}
              aria-label="Menu"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium"
            >
              {open ? "✕" : "☰"}
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-neutral-200 p-3">
            <NavLinks roles={roles} onNavigate={() => setOpen(false)} />
            <UserBox />
          </div>
        )}
      </div>
    </>
  );
}
