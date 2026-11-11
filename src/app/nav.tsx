import Link from "next/link";
import { ThemeToggle } from "../components/theme-toggle";

const primary = [
  { href: "/", label: "Expos" },
  { href: "/lineups", label: "Lineups" },
  { href: "/calendar", label: "Calendar" },
  { href: "/jobs", label: "Jobs" },
  { href: "/settings", label: "Settings" },
] as const;

export function AppNav() {
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="font-medium tracking-tight">
          Expo Tracker
        </Link>
        <div className="flex flex-wrap items-center gap-4">
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
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
