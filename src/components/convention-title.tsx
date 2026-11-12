"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { hrefForWebsite } from "../domain/website";
import { cn } from "../lib/utils";
import { useFruitMask } from "./fruit-mask";

type ConventionTitleProps = {
  name: string;
  website?: string | null;
  fallbackHref?: string;
  as?: "h1" | "span";
  className?: string;
  children?: ReactNode;
};

export function ConventionTitle({
  name,
  website,
  fallbackHref,
  as = "span",
  className,
  children,
}: ConventionTitleProps) {
  const { mask } = useFruitMask();
  const displayName = mask(name);
  const href = hrefForWebsite(website);
  const Tag = as;
  const textClass = cn(
    as === "h1" ? "text-2xl font-semibold tracking-tight" : "font-medium leading-tight",
    className,
  );

  if (href) {
    return (
      <Tag className={textClass}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
        >
          {displayName}
          <ExternalLink className={as === "h1" ? "size-5 shrink-0" : "size-3.5 shrink-0"} aria-hidden />
          <span className="sr-only">(opens website)</span>
        </a>
        {children}
      </Tag>
    );
  }

  if (fallbackHref) {
    return (
      <Tag className={textClass}>
        <Link href={fallbackHref} className="hover:underline">
          {displayName}
        </Link>
        {children}
      </Tag>
    );
  }

  return (
    <Tag className={textClass}>
      {displayName}
      {children}
    </Tag>
  );
}
