import type { Metadata } from "next";
import "./globals.css";
import Nav from "./nav";
import { Toasts } from "@/components/toast";
import { LocaleProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "OxRound — G1 Boxing",
  description: "Combat-sports-first gym operating system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LocaleProvider>
          <div className="flex min-h-screen flex-col md:flex-row">
            <Nav />
            <main className="flex-1 p-4 md:p-8">{children}</main>
          </div>
          <Toasts />
        </LocaleProvider>
      </body>
    </html>
  );
}
