"use client";

import { ClipboardPen, Globe } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { hrefForWebsite } from "../domain/website";
import { cn } from "../lib/utils";
import { useFruitMask } from "./fruit-mask";

type ConventionTitleProps = {
  name: string;
  website?: string | null;
  applicationPage?: string | null;
  fallbackHref?: string;
  as?: "h1" | "span";
  className?: string;
  children?: ReactNode;
};

function ExternalIconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex text-muted-foreground hover:text-foreground"
    >
      {children}
    </a>
  );
}

export function ConventionTitle({
  name,
  website,
  applicationPage,
  fallbackHref,
  as = "span",
  className,
  children,
}: ConventionTitleProps) {
  const { mask } = useFruitMask();
  const displayName = mask(name);
  const websiteHref = hrefForWebsite(website);
  const applicationHref = hrefForWebsite(applicationPage);
  const Tag = as;
  const iconClassName = as === "h1" ? "size-5" : "size-3.5";
  const textClass = cn(
    as === "h1" ? "text-2xl font-semibold tracking-tight" : "font-medium leading-tight",
    className,
  );

  return (
    <Tag className={textClass}>
      {fallbackHref ? (
        <Link href={fallbackHref} className="hover:underline">
          {displayName}
        </Link>
      ) : (
        displayName
      )}
      {websiteHref || applicationHref ? (
        <>
          {" "}
          <span className="inline-flex -translate-y-px items-center gap-1 align-middle">
            {websiteHref ? (
              <ExternalIconLink href={websiteHref} label="Website">
                <Globe className={iconClassName} aria-hidden />
              </ExternalIconLink>
            ) : null}
            {applicationHref ? (
              <ExternalIconLink href={applicationHref} label="Application page">
                <ClipboardPen className={iconClassName} aria-hidden />
              </ExternalIconLink>
            ) : null}
          </span>
        </>
      ) : null}
      {children}
    </Tag>
  );
}
