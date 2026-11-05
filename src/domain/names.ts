const seasons = ["summer", "winter", "spring", "fall"] as const;

export type NameIdentity = {
  key: string;
  cycleLabel: string | null;
  aliasCandidates: string[];
};

export function normalizeName(raw: string): string {
  return identityFromName(raw).key;
}

export function identityFromName(raw: string): NameIdentity {
  const peeled = peelName(raw);
  const affixes = takeYearAndSeason(peeled.base);
  const key = compactKey(affixes.base) || compactKey(peeled.base);
  return {
    key,
    cycleLabel: formatCycle(affixes.year, affixes.season, affixes.number),
    aliasCandidates: peeled.aliasCandidates,
  };
}

export function seriesDisplayName(raw: string): string {
  const peeled = peelName(raw);
  const affixes = takeYearAndSeason(peeled.base);
  return affixes.base.trim() || peeled.base.trim() || raw.trim();
}

export function completeCycleLabel(cycleLabel: string | null, startDate: string | null): string {
  const year = startDate?.slice(0, 4) ?? null;
  if (!cycleLabel) return year ?? "edition";
  if (year && (seasons as readonly string[]).includes(cycleLabel)) {
    return `${year}-${cycleLabel}`;
  }
  return cycleLabel;
}

export function peelName(raw: string): { base: string; aliasCandidates: string[] } {
  const aliasCandidates: string[] = [];
  const base = raw
    .replace(/[（(]([^）)]+)[）)]/g, (_match, inner: string) => {
      const name = inner.trim();
      if (name) aliasCandidates.push(name);
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();
  return { base: base || raw.trim(), aliasCandidates };
}

function takeYearAndSeason(value: string): {
  base: string;
  year: string | null;
  season: string | null;
  number: string | null;
} {
  let current = value.trim();
  let year: string | null = null;
  let season: string | null = null;
  let number: string | null = null;
  let changed = true;
  while (changed && current.length > 0) {
    changed = false;
    const seasonMatch = current.match(/[\s-]+(summer|winter|spring|fall)$/i);
    if (seasonMatch && !season) {
      season = seasonMatch[1].toLowerCase();
      current = current.slice(0, -seasonMatch[0].length).trim();
      changed = true;
      continue;
    }
    const numberMatch = current.match(/[\s-]+(\d+)$/);
    if (numberMatch && !year && !number) {
      const digits = numberMatch[1];
      current = current.slice(0, -numberMatch[0].length).trim();
      if (/^\d{2}$/.test(digits) || /^(?:19|20)\d{2}$/.test(digits)) {
        year = expandYear(digits);
      } else {
        number = digits;
      }
      changed = true;
    }
  }
  return { base: current, year, season, number };
}

function expandYear(value: string): string {
  if (/^\d{2}$/.test(value)) return `20${value}`;
  return value;
}

function formatCycle(year: string | null, season: string | null, number: string | null): string | null {
  if (year && season) return `${year}-${season}`;
  if (year) return year;
  if (season) return season;
  if (number) return number;
  return null;
}

function compactKey(raw: string): string {
  const folded = raw.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  return stripTrailingYearAndSeason(folded.replace(/[^\p{L}\p{N}]+/gu, ""));
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
    const fourDigit = current.match(/^(.*?)((?:19|20)\d{2})$/);
    if (fourDigit && fourDigit[1].length > 0) {
      current = fourDigit[1];
      changed = true;
      continue;
    }
    const twoDigit = current.match(/^(.*[^\d])(\d{2})$/);
    if (twoDigit && twoDigit[1].length > 0) {
      current = twoDigit[1];
      changed = true;
    }
  }
  return current;
}
