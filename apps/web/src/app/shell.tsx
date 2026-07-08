"use client";
// App shell. The member app (/app) is its own product: full-screen, no CRM sidebar,
// shown as a phone-width column centered on desktop. Every other route is the CRM,
// which keeps the sidebar Nav + padded main.

import { usePathname } from "next/navigation";
import Nav from "./nav";

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMemberApp = pathname === "/app" || pathname.startsWith("/app/");

  if (isMemberApp) {
    return (
      <div className="flex min-h-[100dvh] justify-center bg-neutral-200">
        <div className="flex h-[100dvh] w-full max-w-[420px] flex-col overflow-hidden bg-neutral-50 shadow-xl">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Nav />
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
