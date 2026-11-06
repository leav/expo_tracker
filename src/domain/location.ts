export function locationLabel(city: string | null, region: string | null): string | null {
  const parts = [city, region].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}
