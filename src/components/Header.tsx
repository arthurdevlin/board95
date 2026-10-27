import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getSession } from "@/lib/session";
import SignOutButton from "@/components/SignOutButton";

const links = [
  { href: "/transport", label: "Find transport" },
  { href: "/car-hire", label: "Car hire" },
];

// The header itself is static (so every page can still be prerendered).
// Only AccountStatus reads the session, inside its own <Suspense>, so a
// session lookup never forces the whole site to render per-request.
export default function Header() {
  return (
    <header className="site-header border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="text-xl font-bold text-primary">
          Board95
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-primary">
              {l.label}
            </Link>
          ))}
          <Suspense fallback={<span className="user-menu-placeholder" />}>
            <AccountStatus />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function AccountStatus() {
  await connection();
  const session = await getSession();

  if (!session) {
    return (
      <Link href="/sign-in" className="chip">
        Sign in
      </Link>
    );
  }
  return (
    <span className="user-menu">
      <Link href="/account" className="user-chip">
        {session.user.name}
      </Link>
      <SignOutButton />
    </span>
  );
}
