const seasons = ["summer", "winter", "spring", "fall"];

export function normalizeName(raw: string): string {
  const folded = raw.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const compact = folded.replace(/[^\p{L}\p{N}]+/gu, "");
  return stripTrailingYearAndSeason(compact);
}

export function identityFromName(raw: string): { key: string; cycleLabel: string | null } {
  const trimmed = raw.trim();
  const comiket = trimmed.match(/^(?:comic\s*market|comiket)\s+(\d+)$/i);
  if (comiket) {
    return { key: "comiket", cycleLabel: comiket[1] };
  }

  const season = trimmed.match(/^(.*?)[\s-]+(summer|winter|spring|fall)$/i);
  const year = trimmed.match(/^(.*?)[\s-]+((?:19|20)\d{2}|\d{2})$/);
  if (season && season[1].trim()) {
    const yearInBase = season[1].match(/^(.*?)[\s-]+((?:19|20)\d{2}|\d{2})$/);
    const base = yearInBase?.[1]?.trim() || season[1].trim();
    const yearPart = yearInBase?.[2];
    return {
      key: normalizeName(base),
      cycleLabel: yearPart ? `${yearPart}-${season[2].toLowerCase()}` : season[2].toLowerCase(),
    };
  }
  if (year && year[1].trim()) {
    return { key: normalizeName(year[1]), cycleLabel: year[2] };
  }
  return { key: normalizeName(trimmed), cycleLabel: null };
}

function stripTrailingYearAndSeason(value: string): string {
  let current = value;
  let changed = true;
  while (changed && current.length > 0) {
    changed = false;
    for (const season of seasons) {
      if (current.endsWith(season) && current.length > season.length) {
        current = current.slice(0, -season.length);
        changed = true;
      }
    }
    const year = current.match(/^(.*?)((?:19|20)\d{2}|\d{2})$/);
    if (year && year[1].length > 0) {
      current = year[1];
      changed = true;
    }
  }
  return current;
}
