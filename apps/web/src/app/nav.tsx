"use client";
// Responsive nav: desktop = fixed sidebar (unchanged look); mobile = top bar + hamburger.

import { useState } from "react";
import Link from "next/link";

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

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar — identical to the original */}
      <aside className="hidden w-56 shrink-0 border-r border-neutral-200 bg-white p-4 md:block">
        <div className="mb-8"><Brand /></div>
        <NavLinks />
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
          </div>
        )}
      </div>
    </>
  );
}
