import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "OxRound — G1 Boxing",
  description: "Combat-sports-first gym operating system",
};

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/members", label: "Members" },
  { href: "/attendance", label: "Attendance" },
  { href: "/announcements", label: "Announcements" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <aside className="w-56 shrink-0 border-r border-neutral-200 bg-white p-4">
            <div className="mb-8 flex items-center gap-2 px-2">
              <span className="text-xl">🥊</span>
              <div>
                <div className="font-bold tracking-tight">OxRound</div>
                <div className="text-xs text-neutral-500">G1 Boxing</div>
              </div>
            </div>
            <nav className="space-y-1">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-red-50 hover:text-brand"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
