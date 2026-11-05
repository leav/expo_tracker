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
  const special = specialIdentity(peeled.base);
  if (special) {
    return { ...special, aliasCandidates: peeled.aliasCandidates };
  }

  const affixes = takeYearAndSeason(peeled.base);
  const key = compactKey(affixes.base) || compactKey(peeled.base);
  return {
    key,
    cycleLabel: formatCycle(affixes.year, affixes.season),
    aliasCandidates: peeled.aliasCandidates,
  };
}

export function seriesDisplayName(raw: string): string {
  const identity = identityFromName(raw);
  if (identity.key === "comiket") return "Comiket";
  if (identity.key === "sanjosemade") return "San José Made";
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

function specialIdentity(base: string): { key: string; cycleLabel: string | null } | null {
  const comiket = base.match(/^(?:comic\s*market|comiket)(?:\s+(\d+))?$/i);
  if (comiket) {
    return { key: "comiket", cycleLabel: comiket[1] ?? null };
  }

  const sjMade = base.match(/^(?:san\s*jos[eé]\s*made|sj\s*made)\b(.*)$/i);
  if (sjMade) {
    const rest = sjMade[1].trim();
    const affixes = takeYearAndSeason(rest);
    let season = affixes.season;
    if (!season) {
      const inner = rest.match(/\b(summer|winter|spring|fall)\b/i);
      if (inner) season = inner[1].toLowerCase();
    }
    const leftover = affixes.base.replace(/\b(summer|winter|spring|fall)\b/gi, "").replace(/\s+/g, " ").trim();
    return {
      key: "sanjosemade",
      cycleLabel: formatCycle(affixes.year, season) ?? (leftover ? compactKey(leftover) : null),
    };
  }

  return null;
}

function takeYearAndSeason(value: string): { base: string; year: string | null; season: string | null } {
  let current = value.trim();
  let year: string | null = null;
  let season: string | null = null;
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
    const yearMatch = current.match(/[\s-]+((?:19|20)\d{2}|\d{2})$/);
    if (yearMatch && !year) {
      year = expandYear(yearMatch[1]);
      current = current.slice(0, -yearMatch[0].length).trim();
      changed = true;
    }
  }
  return { base: current, year, season };
}

function expandYear(value: string): string {
  if (/^\d{2}$/.test(value)) return `20${value}`;
  return value;
}

function formatCycle(year: string | null, season: string | null): string | null {
  if (year && season) return `${year}-${season}`;
  if (year) return year;
  if (season) return season;
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
    const year = current.match(/^(.*?)((?:19|20)\d{2}|\d{2})$/);
    if (year && year[1].length > 0) {
      current = year[1];
      changed = true;
    }
  }
  return current;
}
