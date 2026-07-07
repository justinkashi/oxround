"use client";
// Responsive nav: desktop = fixed sidebar (unchanged look); mobile = top bar + hamburger.
// Real mode: shows the signed-in email + logout. Demo mode: shows nothing extra.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMyRoles, getOwnerNotifications, isDemoMode, supabase, type OwnerNotification } from "@/lib/data";
import { LanguageToggle, useT, type Messages } from "@/lib/i18n";

// `roles` = who can see the tab. Empty = everyone (staff). D-21 permissions matrix.
// `label` is a key into t.nav so the sidebar follows the language toggle.
const nav: { href: string; label: keyof Messages["nav"]; roles?: string[] }[] = [
  { href: "/", label: "dashboard" },
  { href: "/members", label: "members" },
  { href: "/classes", label: "classes" },
  { href: "/scanner", label: "scanner" },
  { href: "/attendance", label: "attendance", roles: ["owner", "manager"] },
  { href: "/payments", label: "payments", roles: ["owner", "manager", "receptionist"] },
  { href: "/plans", label: "plans", roles: ["owner", "manager"] },
  { href: "/leads", label: "leads", roles: ["owner", "manager", "receptionist"] },
  { href: "/coaches", label: "coaches", roles: ["owner", "manager"] },
  { href: "/announcements", label: "community" },
  { href: "/messages", label: "messages" },
  { href: "/reports", label: "reports", roles: ["owner", "manager"] },
  { href: "/settings", label: "settings", roles: ["owner", "manager"] },
];

const extras: { href: string; label: keyof Messages["nav"] }[] = [
  { href: "/app", label: "memberAppPreview" },
];

function visibleNav(roles: string[]) {
  // Demo mode (roles=[owner]) sees everything. Staff see tabs allowed for their role.
  return nav.filter((n) => !n.roles || n.roles.some((r) => roles.includes(r)));
}

function NavLinks({ roles, onNavigate }: { roles: string[]; onNavigate?: () => void }) {
  const t = useT();
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
            {t.nav[n.label]}
          </Link>
        ))}
      </nav>
      <div className="mt-8 space-y-1 border-t border-neutral-200 pt-4">
        {extras.map((n) => (
          <Link key={n.href} href={n.href} onClick={onNavigate} className="block rounded-md px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-50">
            {t.nav[n.label]}
          </Link>
        ))}
        <div className="px-3 pt-2"><LanguageToggle /></div>
      </div>
    </>
  );
}

function NotificationBell() {
  const t = useT();
  const [items, setItems] = useState<OwnerNotification[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { getOwnerNotifications().then(setItems).catch(() => {}); }, []);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-label={t.nav.notifications} className="relative rounded-md px-2 py-1 text-lg hover:bg-neutral-100">
        🔔
        {items.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{items.length}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-neutral-200 bg-white p-2 shadow-lg md:right-auto md:left-0">
          <div className="px-2 py-1 text-xs font-semibold uppercase text-neutral-400">{t.nav.alerts}</div>
          {items.length === 0 && <div className="px-2 py-3 text-center text-xs text-neutral-400">{t.nav.allClear}</div>}
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
  const t = useT();
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
        {t.nav.logOut}
      </button>
    </div>
  );
}

export default function Nav() {
  const t = useT();
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
              aria-label={t.nav.menu}
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
