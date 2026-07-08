import type { Metadata } from "next";
import "./globals.css";
import Shell from "./shell";
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
          <Shell>{children}</Shell>
          <Toasts />
        </LocaleProvider>
      </body>
    </html>
  );
}
