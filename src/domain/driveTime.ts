const seedHours: Record<string, number> = {
  "san jose": 1.25,
  "san francisco": 0.75,
  sacramento: 1.75,
  "los angeles": 6,
  pasadena: 6,
  "long beach": 6,
  anaheim: 6,
  "san diego": 8.5,
  "las vegas": 8.5,
  portland: 10,
  phoenix: 13,
  "salt lake city": 13,
  seattle: 13.5,
};

export type DriveSource = "seed" | "manual";

export function cityKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const beforeComma = value.split(",")[0] ?? value;
  const key = beforeComma
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return key.length > 0 ? key : null;
}

export function seedDriveMinutes(city: string | null | undefined): number | null {
  const key = cityKey(city);
  if (!key) return null;
  const hours = seedHours[key];
  if (hours === undefined) return null;
  return Math.round(hours * 60);
}

export function resolveDriveTime(input: {
  city: string | null | undefined;
  currentMinutes: number | null;
  currentSource: string | null;
  manualMinutes?: number | null;
  cityChanged?: boolean;
}): { driveMinutes: number | null; driveSource: DriveSource | null } {
  if (input.manualMinutes != null) {
    return { driveMinutes: input.manualMinutes, driveSource: "manual" };
  }
  if (input.currentSource === "manual" && !input.cityChanged) {
    return { driveMinutes: input.currentMinutes, driveSource: "manual" };
  }
  const seeded = seedDriveMinutes(input.city);
  if (seeded == null) return { driveMinutes: null, driveSource: null };
  return { driveMinutes: seeded, driveSource: "seed" };
}
