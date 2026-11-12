"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { consPath } from "../../lib/routes";

export default function SeriesPage() {
  return (
    <Suspense>
      <SeriesRedirect />
    </Suspense>
  );
}

function SeriesRedirect() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");

  useEffect(() => {
    router.replace(id ? consPath(Number(id)) : "/");
  }, [id, router]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
      Redirecting…
    </main>
  );
}
