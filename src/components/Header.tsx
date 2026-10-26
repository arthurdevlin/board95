import Link from "next/link";

const links = [
  { href: "/transport", label: "Find transport" },
  { href: "/car-hire", label: "Car hire" },
];

export default function Header() {
  return (
    <header className="border-b border-black/10 bg-white">
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
          {/* Placeholder: real sign-in arrives in Milestone 3 */}
          <span className="rounded-full border border-muted/40 px-3 py-1 text-muted">
            Sign in (soon)
          </span>
        </nav>
      </div>
    </header>
  );
}
