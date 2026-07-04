"use client";
// Responsive nav: desktop = fixed sidebar (unchanged look); mobile = top bar + hamburger.
// Real mode: shows the signed-in email + logout. Demo mode: shows nothing extra.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isDemoMode, supabase } from "@/lib/data";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/members", label: "Members" },
  { href: "/classes", label: "Classes" },
  { href: "/attendance", label: "Attendance" },
  { href: "/payments", label: "Payments" },
  { href: "/plans", label: "Plans" },
  { href: "/leads", label: "Leads" },
  { href: "/coaches", label: "Coaches" },
  { href: "/announcements", label: "Announcements" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

const extras = [
  { href: "/app", label: "📱 Member app preview" },
  { href: "/login", label: "🔒 Login screen" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <nav className="space-y-1">
        {nav.map((n) => (
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

  return (
    <>
      {/* Desktop sidebar — identical to the original */}
      <aside className="hidden w-56 shrink-0 border-r border-neutral-200 bg-white p-4 md:block">
        <div className="mb-8"><Brand /></div>
        <NavLinks />
        <UserBox />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 border-b border-neutral-200 bg-white md:hidden">
        <div className="flex items-center justify-between p-3">
          <Brand />
          <button
            onClick={() => setOpen(!open)}
            aria-label="Menu"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
        {open && (
          <div className="border-t border-neutral-200 p-3">
            <NavLinks onNavigate={() => setOpen(false)} />
            <UserBox />
          </div>
        )}
      </div>
    </>
  );
}
