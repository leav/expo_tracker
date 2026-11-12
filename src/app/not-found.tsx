"use client";

import Link from "next/link";
import { useEffect } from "react";
import { consPath } from "../lib/routes";

export default function NotFound() {
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    let path = window.location.pathname;
    if (base && path.startsWith(base)) path = path.slice(base.length) || "/";
    path = path.replace(/\/$/, "") || "/";
    const match = path.match(/^\/(?:cons|series)\/(\d+)$/);
    if (match) {
      window.location.replace(`${base}${consPath(Number(match[1]))}`);
    }
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
      Page not found. <Link href="/" className="underline underline-offset-2">Back to Expos</Link>
    </main>
  );
}
