export function hrefForWebsite(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return null;
  }
  if (lower.startsWith("mailto:") || lower.startsWith("tel:") || lower.startsWith("ftp:")) {
    return null;
  }
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return trimmed;
    } catch {
      return null;
    }
  }
  if (trimmed.includes(" ") || trimmed.includes("://") || !trimmed.includes(".")) return null;
  try {
    const url = new URL(`https://${trimmed}`);
    if (url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}
