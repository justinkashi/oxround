import type { Metadata } from "next";
import "./globals.css";
import Nav from "./nav";
import { Toasts } from "@/components/toast";

export const metadata: Metadata = {
  title: "OxRound — G1 Boxing",
  description: "Combat-sports-first gym operating system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col md:flex-row">
          <Nav />
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
        <Toasts />
      </body>
    </html>
  );
}
