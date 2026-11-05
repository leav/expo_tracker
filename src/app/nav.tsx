import Link from "next/link";

const primary = [
  { href: "/", label: "Cons" },
  { href: "/lineups", label: "Lineups" },
  { href: "/jobs", label: "Jobs" },
  { href: "/settings", label: "Settings" },
] as const;

export function AppNav() {
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="font-medium tracking-tight">
          Artist-alley tracker
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm">
          {primary.map((item) => (
            <Link key={item.href} className="underline-offset-4 hover:underline" href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link className="text-muted-foreground underline-offset-4 hover:underline" href="/import">
            Import
          </Link>
        </nav>
      </div>
    </header>
  );
}
