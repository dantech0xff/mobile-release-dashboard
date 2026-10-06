import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mobile Release Dashboard",
  description: "Version bump, build, sign and release pipeline for mobile projects",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-6">
          <Link href="/" className="font-semibold text-zinc-100">
            Mobile Release Dashboard
          </Link>
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-100">
            Projects
          </Link>
          <Link href="/secrets" className="text-sm text-zinc-400 hover:text-zinc-100">
            Secrets
          </Link>
        </nav>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
